import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { MessageProvider } from "./components/message/MessageProvider";
import "./firebase.js";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MessageProvider>
      <App />
    </MessageProvider>
  </React.StrictMode>
);