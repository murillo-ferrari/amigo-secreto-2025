import AppRouter from "./components/AppRouter";
import { MessageProvider } from "./components/message/MessageProvider";
import { EventProvider } from "./context/EventContext";
import { FirebaseProvider } from "./context/FirebaseContext";

/**
 * SecretSantaApp is the main component of the Secret Santa web app.
 * It now acts as a Provider wrapper, delegating logic to Context and Router.
 */
export default function SecretSantaApp() {
  return (
    <FirebaseProvider>
      <MessageProvider>
        <EventProvider>
          <AppRouter />
        </EventProvider>
      </MessageProvider>
    </FirebaseProvider>
  );
}
