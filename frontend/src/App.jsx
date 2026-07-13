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
import IncomingCallNotification from './components/IncomingCallNotification';
import CallWindow from './components/CallWindow';
import CallEndedScreen from './components/call/CallEndedScreen';
import NotificationPermissionBanner from './components/NotificationPermissionBanner';
import { CreateStatusModal } from './components/status';
import { useStatusStore } from './store/useStatusStore';
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

  // Network monitoring + offline queue flush
  useEffect(() => {
    if (authUser) initNetwork();
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
    if (chatId || groupId) {
      applyConversationSwitch({ chatId, groupId });
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

  if (isCheckingAuth && !authUser)
    return (
      <div className="flex items-center justify-center h-screen bg-base-100">
        {/* Loader removed based on user request */}
      </div>
    );
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

      {/* WhatsApp-style Status */}
      {authUser && (
        <>
          <CreateStatusModal />
          <Suspense fallback={null}>
            <StatusViewer />
          </Suspense>
        </>
      )}
    </div>
  )
}

export default App
