import { useEvent } from "../context/EventContext";
import ErrorScreen from "./common/ErrorScreen";
import EventAdmin from "./event/admin/EventAdmin";
import EventCreate from "./event/EventCreate";
import EventHome from "./event/EventHome";
import EventParticipant from "./event/EventParticipant";
import EventPhoneVerification from "./event/EventPhoneVerification";
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
        case "create":
            return <EventCreate />;
        case "verify-phone":
            return <EventPhoneVerification />;
        case "event":
            return <EventParticipant />;
        case "admin":
            return <EventAdmin />;
        case "result":
            return <SecretSantaResults />;
        default:
            return <EventHome />;
    }
}
