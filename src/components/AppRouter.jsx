import { useEvent } from "../context/EventContext";
import ErrorScreen from "./common/ErrorScreen";
import AdminEvento from "./event/EventAdmin";
import CriarEvento from "./event/EventCreate";
import Home from "./event/EventHome";
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
            return <Home />;
        case "criar":
            return <CriarEvento />;
        case "evento":
            return <EventParticipant />;
        case "admin":
            return <AdminEvento />;
        case "resultado":
            return <SecretSantaResults />;
        default:
            return <Home />;
    }
}
