import { supabase } from "../lib/supabase.js";

export const createChat = async (userId: string, firstQuestion: string) => {
  const { data, error } = await supabase
    .from("chats")
    .insert({
      user_id: userId,
      title: firstQuestion.slice(0, 60),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const saveMessage = async (
  chatId: string,
  userId: string,
  query: string,
  answer: string,
  hadPdf: boolean,
) => {
  const { error } = await supabase.from("messages").insert({
    chat_id: chatId,
    user_id: userId,
    query,
    answer,
    had_pdf: hadPdf,
  });

  if (error) throw error;
};

export const getUserChats = async (userId: string) => {
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

export const getChatMessages = async (chatId: string) => {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
};

/** Loads messages only if the chat belongs to this Supabase user. */
export const getChatMessagesForUser = async (
  chatId: string,
  userId: string,
) => {
  const { data: chat, error: chatErr } = await supabase
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", userId)
    .maybeSingle();

  if (chatErr) throw chatErr;
  if (!chat) return null;

  return getChatMessages(chatId);
};

export const deleteChat = async (chatId: string, userId: string) => {
  const { error } = await supabase
    .from("chats")
    .delete()
    .eq("id", chatId)
    .eq("user_id", userId);

  if (error) throw error;
};
