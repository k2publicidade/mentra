import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: false };
  }
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <main className="boot">
          <h1>Precisamos reabrir seu espaço.</h1>
          <p role="alert">
            A interface encontrou um erro. Seus registros salvos continuam no
            servidor.
          </p>
          <button className="primary" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </main>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
