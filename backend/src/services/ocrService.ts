import axios from "axios";
import FormData from "form-data";

const OCR_MAX_SIZE_KB = 1024;
const OCR_MAX_SIZE_BYTES = OCR_MAX_SIZE_KB * 1024;

export const validatePDFSize = (buffer: Buffer): void => {
  const sizeKB = buffer.length / 1024;
  if (buffer.length > OCR_MAX_SIZE_BYTES) {
    throw new Error(
      `PDF is too large for OCR (${Math.round(sizeKB)}KB). Please compress it to under ${OCR_MAX_SIZE_KB}KB using tools like ilovepdf.com or smallpdf.com.`,
    );
  }
};

export const extractTextFromPDF = async (
  fileBuffer: Buffer,
  fileName: string = "upload.pdf",
): Promise<{ text: string; method: "pdf2json" | "ocr" }> => {
  // Try pdf2json first (works for text-based PDFs)
  try {
    const text = await tryPdf2Json(fileBuffer);
    if (text && text.trim().length >= 50) {
      return { text, method: "pdf2json" };
    }
    console.log("⚠️  pdf2json returned insufficient text — trying OCR...");
  } catch {
    console.log("⚠️  pdf2json failed — trying OCR...");
  }

  // Fall back to OCR for image-based PDFs
  validatePDFSize(fileBuffer);
  const text = await tryOCR(fileBuffer, fileName);
  return { text, method: "ocr" };
};

// ── pdf2json extraction ──
const tryPdf2Json = (buffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Dynamic import to avoid issues
    import("pdf2json")
      .then(({ default: PDFParser }) => {
        const pdfParser = new PDFParser();

        pdfParser.on("pdfParser_dataReady", (data: any) => {
          const rawText = data.Pages.map((page: any) =>
            page.Texts.map((t: any) =>
              decodeURIComponent(t.R.map((r: any) => r.T).join("")),
            ).join(" "),
          ).join("\n");
          resolve(rawText);
        });

        pdfParser.on("pdfParser_dataError", reject);
        pdfParser.parseBuffer(buffer);
      })
      .catch(reject);
  });
};

// ── OCR.space extraction ──
const tryOCR = async (buffer: Buffer, fileName: string): Promise<string> => {
  if (!process.env.OCR_API_KEY) {
    console.error("OCR misconfiguration: API key is not set");
    throw new Error(
      "Document processing is temporarily unavailable. Please try again later.",
    );
  }

  const formData = new FormData();
  formData.append("file", buffer, {
    filename: fileName,
    contentType: "application/pdf",
  });
  formData.append("language", "eng");
  formData.append("apikey", process.env.OCR_API_KEY);
  formData.append("OCREngine", "2");
  formData.append("scale", "true");
  formData.append("isTable", "false");

  let response;
  try {
    response = await axios.post("https://api.ocr.space/parse/image", formData, {
      headers: { ...formData.getHeaders() },
      timeout: 30000, // 30 second timeout
    });
  } catch (err: any) {
    if (err.code === "ECONNABORTED") {
      throw new Error(
        "OCR request timed out. Please try again with a smaller PDF.",
      );
    }
    throw new Error("Failed to reach OCR service. Please try again later.");
  }

  const data = response.data;

  // OCR API level errors
  if (data.IsErroredOnProcessing) {
    const errorMsg = data.ErrorMessage?.[0] ?? "Unknown OCR error";

    if (errorMsg.includes("File size")) {
      throw new Error(
        `PDF is too large for OCR. Please compress it to under ${OCR_MAX_SIZE_KB}KB.`,
      );
    }
    if (errorMsg.includes("limit")) {
      throw new Error("OCR free tier limit reached. Please try again later.");
    }

    console.error("OCR API processing error:", errorMsg);
    throw new Error(
      "We couldn't read this document. Try a smaller, clearer, or text-based PDF.",
    );
  }

  const result = data.ParsedResults?.[0];

  if (!result) {
    throw new Error(
      "OCR returned no results. The PDF may be corrupted or unreadable.",
    );
  }

  if (result.FileParseExitCode === -1) {
    throw new Error(
      "OCR could not parse this PDF. Please ensure it is a valid, unencrypted PDF under 1024KB.",
    );
  }

  const text = result.ParsedText?.trim();
  if (!text || text.length < 20) {
    throw new Error(
      "OCR could not extract readable text. The PDF may be too blurry, encrypted, or in an unsupported format.",
    );
  }

  console.log(`✅ OCR extracted ${text.length} characters`);
  return text;
};
