import { useEvent } from "../context/EventContext";
import ErrorScreen from "./common/ErrorScreen";
import EventAdmin from "./event/EventAdmin";
import EventCreate from "./event/EventCreate";
import EventHome from "./event/EventHome";
import EventParticipant from "./event/EventParticipant";
import SecretSantaResults from "./event/EventResults";

export default function AppRouter() {
    const { view, storageError, setStorageError } = useEvent();

    if (storageError) {
        return (
            <ErrorScreen
                error={storageError}
                onRetry={() => {
                    setStorageError(null);
                    window.location.reload();
                }}
            />
        );
    }

    switch (view) {
        case "home":
            return <EventHome />;
        case "criar":
            return <EventCreate />;
        case "evento":
            return <EventParticipant />;
        case "admin":
            return <EventAdmin />;
        case "resultado":
            return <SecretSantaResults />;
        default:
            return <EventHome />;
    }
}
