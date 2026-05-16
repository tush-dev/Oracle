import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import ChatPage from "./pages/ChatPage";
import GithubOAuthCallbackBridge from "./pages/GithubOAuthCallbackBridge";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/github/callback" element={<GithubOAuthCallbackBridge />} />
        <Route path="/" element={<ChatPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
