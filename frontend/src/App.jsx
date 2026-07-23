import { useEffect, lazy, Suspense } from 'react'
import './App.css'
import LeftNavbar from './components/LeftNavbar';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import SignUpPage from './pages/SignUpPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import SettingsPage from './pages/SettingsPage';
import StarredMessagesPage from './pages/StarredMessagesPage';
import InsightsPage from './pages/InsightsPage';
import { useNetworkStore } from './store/useNetworkStore';
import { useEdgeSwipeBack } from './hooks/useEdgeSwipeBack';
import EdgeSwipeOverlay from './components/EdgeSwipeOverlay';
import { haptic } from './lib/haptics';
import ProfilePage from './pages/ProfilePage';
import ContactPage from './pages/ContactPage';
import NotificationPage from './pages/NotificationPage';
import LoginHelp from './pages/LoginHelp';
import CallHistoryPage from './pages/CallHistoryPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import AdminPage from './pages/AdminPage';
import JoinGroupPage from './pages/JoinGroupPage';
import { useAuthStore } from './store/useAuthStore';
import { useChatStore } from './store/useChatStore';
import { useGroupStore } from './store/useGroupStore';

import { Toaster } from 'react-hot-toast';
import { useThemeStore } from './store/useThemeStore';
import Otp from './components/Otp';
import {
  applyConversationSwitch,
  flushPendingNotificationOpen,
} from './lib/openFromNotification';
import { subscribeToWebPush } from './lib/notifications';
import IncomingCallNotification from './components/IncomingCallNotification';
import CallWindow from './components/CallWindow';
import CallEndedScreen from './components/call/CallEndedScreen';
import NotificationPermissionBanner from './components/NotificationPermissionBanner';
import NotificationPromptModal from './components/NotificationPromptModal';
import { CreateStatusModal } from './components/status';
import { useStatusStore } from './store/useStatusStore';
import { useGroupVibeStore } from './store/useGroupVibeStore';
import { GroupVibeCreatorModal } from './components/groupVibes/GroupVibeCreatorModal';
import { GroupVibeViewerModal } from './components/groupVibes/GroupVibeViewerModal';
import { GroupVibeArchiveModal } from './components/groupVibes/GroupVibeArchiveModal';
import { useVisualViewportKeyboard } from './hooks/useVisualViewportKeyboard';
import { useComposerLayout } from './hooks/useComposerLayout';

const StatusViewer = lazy(() => import('./components/status/StatusViewer'));

function App() {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();
  const socket = useAuthStore((state) => state.socket);
  const { theme } = useThemeStore();
  const { subscribeToMessages, unsubscribeFromMessages } = useChatStore();
  const { subscribeToGroupEvents, unsubscribeFromGroupEvents } = useGroupStore();
  const subscribeToStatusEvents = useStatusStore((s) => s.subscribeToStatusEvents);
  const unsubscribeFromStatusEvents = useStatusStore((s) => s.unsubscribeFromStatusEvents);
  const navigate = useNavigate();
  const location = useLocation();
  const initNetwork = useNetworkStore((s) => s.init);

  // Global keyboard inset for composer docking + bottom-nav hide
  useVisualViewportKeyboard();
  useComposerLayout();

  // Network monitoring + offline queue flush + web push registration
  useEffect(() => {
    if (authUser) {
      initNetwork();
      subscribeToWebPush().catch(() => {});
    }
  }, [authUser, initNetwork]);

  // iOS-style edge swipe back (skip on home chat list with no deeper route stack needs)
  const canEdgeBack =
    !!authUser &&
    location.pathname !== "/" &&
    !location.pathname.startsWith("/login") &&
    !location.pathname.startsWith("/signup");

  const { offset, progress, dragging } = useEdgeSwipeBack(
    () => {
      haptic("selection");
      navigate(-1);
    },
    { enabled: canEdgeBack }
  );

  // Subscribe to messages globally when authUser and socket are available
  useEffect(() => {
    if (authUser && socket) {
      subscribeToMessages();
      return () => unsubscribeFromMessages();
    }
  }, [authUser, socket, subscribeToMessages, unsubscribeFromMessages]);

  // Group socket events — must stay active when Sidebar unmounts (mobile in-chat)
  useEffect(() => {
    if (authUser && socket) {
      subscribeToGroupEvents();
      return () => unsubscribeFromGroupEvents();
    }
  }, [authUser, socket, subscribeToGroupEvents, unsubscribeFromGroupEvents]);

  // Sync missed messages when tab regains focus
  useEffect(() => {
    if (!authUser || !socket) return;
    const sync = () => {
      if (document.visibilityState === "visible") {
        useAuthStore.getState().syncLiveConversations?.();
      }
    };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, [authUser, socket]);

  // Live status updates (create / delete / view) without page refresh
  useEffect(() => {
    if (authUser && socket) {
      subscribeToStatusEvents();
      return () => unsubscribeFromStatusEvents();
    }
  }, [authUser, socket, subscribeToStatusEvents, unsubscribeFromStatusEvents]);

  // Live Group Vibes updates (created / deleted / viewed / reaction)
  useEffect(() => {
    if (!authUser || !socket) return;

    const handleCreated = (data) => useGroupVibeStore.getState().handleSocketVibeCreated(data);
    const handleDeleted = (data) => useGroupVibeStore.getState().handleSocketVibeDeleted(data);
    const handleViewed = (data) => useGroupVibeStore.getState().handleSocketVibeViewed(data);
    const handleReaction = (data) => useGroupVibeStore.getState().handleSocketVibeReaction(data);

    socket.on("group:vibe:created", handleCreated);
    socket.on("group:vibe:deleted", handleDeleted);
    socket.on("group:vibe:viewed", handleViewed);
    socket.on("group:vibe:reaction", handleReaction);

    useGroupVibeStore.getState().fetchGroupVibesSummary();

    return () => {
      socket.off("group:vibe:created", handleCreated);
      socket.off("group:vibe:deleted", handleDeleted);
      socket.off("group:vibe:viewed", handleViewed);
      socket.off("group:vibe:reaction", handleReaction);
    };
  }, [authUser, socket]);

  useEffect(() => {
    // Check for token in URL (from Google OAuth)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    if (token) {
      useAuthStore.getState().setAuthUserFromToken(token);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      checkAuth();
    }
  }, [checkAuth]);

  // Soft navigate home + open chat (no full page refresh)
  useEffect(() => {
    const onSpaOpen = (e) => {
      const detail = e.detail || {};
      try {
        sessionStorage.setItem("pendingNotificationOpen", JSON.stringify(detail));
      } catch (_) {
        /* ignore */
      }
      if (location.pathname !== "/") {
        navigate("/");
      } else {
        applyConversationSwitch(detail);
        flushPendingNotificationOpen();
      }
    };
    window.addEventListener("spa-go-home-open-chat", onSpaOpen);
    return () => window.removeEventListener("spa-go-home-open-chat", onSpaOpen);
  }, [navigate, location.pathname]);

  // Apply pending notification open once we're on home + authenticated
  useEffect(() => {
    if (!authUser) return;
    if (location.pathname !== "/") return;

    const params = new URLSearchParams(window.location.search);
    const chatId = params.get("chat");
    const groupId = params.get("group");
    const replyText = params.get("replyText");
    if (chatId || groupId) {
      applyConversationSwitch({ chatId, groupId, replyText });
      window.history.replaceState({}, document.title, "/");
      return;
    }
    // Small delay lets HomePage mount before store-driven chat panel paint
    const t = window.setTimeout(() => {
      flushPendingNotificationOpen();
    }, 0);
    return () => window.clearTimeout(t);
  }, [authUser, location.pathname]);

  // console.log({ authUser })

  if (isCheckingAuth && !authUser) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-base-100 text-base-content select-none">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="size-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-9 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 00-1.032-.121H4.072c-.352 0-.698.042-1.032.121.114-1.866 1.483-3.476 3.405-3.727zM3 8.25a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 8.25v6a2.25 2.25 0 01-2.25 2.25H14.121l-3.268 3.268a1.125 1.125 0 01-1.591 0L6 16.5H5.25A2.25 2.25 0 013 14.25v-6z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            ChatAppey
          </span>
        </div>
      </div>
    );
  }
  return (
    <div data-theme={theme}>
      {authUser && <LeftNavbar />}
      <EdgeSwipeOverlay offset={offset} dragging={dragging} progress={progress} />
      <Routes>
        <Route path='/' element={authUser ? <HomePage /> : <LandingPage />} />
        <Route path='/signup' element={!authUser ? <SignUpPage /> : <Navigate to="/" />} />
        <Route path='/login' element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
        <Route path='/loginhelp' element={!authUser ? <LoginHelp /> : <Navigate to="/" />} />
        <Route path='/settings' element={authUser ? <SettingsPage /> : <Navigate to="/login" />} />
        <Route path='/starred' element={authUser ? <StarredMessagesPage /> : <Navigate to="/login" />} />
        <Route path='/insights' element={authUser ? <InsightsPage /> : <Navigate to="/login" />} />
        <Route path='/contacts' element={authUser ? <ContactPage /> : <Navigate to="/login" />} />
        <Route path='/notifications' element={authUser ? <NotificationPage /> : <Navigate to="/login" />} />
        <Route path='/calls' element={authUser ? <CallHistoryPage /> : <Navigate to="/login" />} />
        <Route path='/terms' element={<TermsPage />} />
        <Route path='/privacy' element={<PrivacyPage />} />
        <Route path='/otp' element={<Otp />} />
        <Route path='/profile' element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
        <Route path='/admin' element={authUser?.role === 'admin' ? <AdminPage /> : <Navigate to="/" />} />
        <Route path='/join/:groupId' element={<JoinGroupPage />} />
      </Routes>

      <Toaster
        position="top-right"
        reverseOrder={false}
      />

      {/* Call Components */}
      <IncomingCallNotification />
      <CallWindow />
      <CallEndedScreen />
      {authUser && <NotificationPermissionBanner />}
      <NotificationPromptModal />

      {/* WhatsApp-style Status */}
      {authUser && (
        <>
          <CreateStatusModal />
          <Suspense fallback={null}>
            <StatusViewer />
          </Suspense>
          {/* Group Vibes Modals */}
          <GroupVibeCreatorModal />
          <GroupVibeViewerModal />
          <GroupVibeArchiveModal />
        </>
      )}
    </div>
  )
}

export default App
