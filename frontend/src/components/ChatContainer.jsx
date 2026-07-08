import { useChatStore } from "../store/useChatStore";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import MessageReactions from "./MessageReactions";
import MessageEditField from "./MessageEditField";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { formatMessageTime, formatDateSeparator, getMessageDateKey } from "../lib/utils";
import defaultImg from "../public/avatar.png";
import { Ban, Check, CheckCheck, Download, Forward, Search, UserPlus, Reply, FileText, Pin, Clock, Mic, Play, Pause, X, ZoomIn, ZoomOut } from "lucide-react";
import "./ChatContainer.css";
import { Dialog, DialogTitle, DialogActions, Button, Typography, DialogContent, Avatar, List, ListItem, ListItemAvatar, ListItemText, Divider, Box, InputAdornment, TextField, } from "@mui/material";
import toast from "react-hot-toast";
import { useSwipeBack } from "../hooks/useSwipeBack";
import MessageActionMenu, {
  MessageMenuTrigger,
  buildPrivateChatActions,
} from "./MessageActionMenu";
import SwipeableMessageBubble from "./SwipeableMessageBubble";
import ChatSearchBar, { highlightText } from "./chat/ChatSearchBar";
import VideoMessage from "./chat/VideoMessage";
import { useChatFeaturesStore } from "../store/useChatFeaturesStore";
import { resolveWallpaperStyle, getDefaultWallpaper } from "../lib/chatWallpaper";
import DoubleTapLike from "./DoubleTapLike";
import { haptic } from "../lib/haptics";

// Custom Audio Player Component
const AudioPlayer = ({ audioUrl, isMyMessage }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 p-3 bg-base-100/10 rounded-xl my-1 border border-base-content/10 max-w-[280px]">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={`p-2 rounded-full flex-shrink-0 transition-all ${isMyMessage
          ? 'bg-primary-content/20 hover:bg-primary-content/30'
          : 'bg-base-content/10 hover:bg-base-content/20'
          }`}
      >
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      </button>

      {/* Waveform / Progress Bar */}
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="h-1 bg-base-content/20 rounded-full cursor-pointer relative overflow-hidden"
          onClick={handleProgressClick}
        >
          <div
            className={`h-full rounded-full transition-all ${isMyMessage ? 'bg-primary-content' : 'bg-secondary'
              }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs opacity-60">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Mic Icon */}
      <div className="flex-shrink-0 opacity-50">
        <Mic size={16} />
      </div>
    </div>
  );
};

const ChatContainer = () => {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deletePopupMessageId, setDeletePopupMessageId] = useState(null);
  const [forwardPopupMessageId, setForwardPopupMessageId] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isForwardLoading, setIsForwardLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [searchActiveId, setSearchActiveId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [wallpaper, setWallpaper] = useState(getDefaultWallpaper());
  const blockedUsersCache = useRef(null);
  const toggleStar = useChatFeaturesStore((s) => s.toggleStar);
  const isStarred = useChatFeaturesStore((s) => s.isStarred);
  const loadStarredIds = useChatFeaturesStore((s) => s.loadStarredIds);
  const getPreference = useChatFeaturesStore((s) => s.getPreference);

  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    setSelectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    deleteForAllMessage,
    users,
    forwardMessage,
    sendFriendRequest,
    setReplyingToMessage,
    isTyping,
    togglePinMessage,
    votePoll,
    sendReaction,
    editMessage
  } = useChatStore(useShallow((state) => ({
    messages: state.messages,
    getMessages: state.getMessages,
    isMessagesLoading: state.isMessagesLoading,
    selectedUser: state.selectedUser,
    setSelectedUser: state.setSelectedUser,
    subscribeToMessages: state.subscribeToMessages,
    unsubscribeFromMessages: state.unsubscribeFromMessages,
    deleteForAllMessage: state.deleteForAllMessage,
    users: state.users,
    forwardMessage: state.forwardMessage,
    sendFriendRequest: state.sendFriendRequest,
    setReplyingToMessage: state.setReplyingToMessage,
    isTyping: state.isTyping,
    togglePinMessage: state.togglePinMessage,
    votePoll: state.votePoll,
    sendReaction: state.sendReaction,
    editMessage: state.editMessage,
  })));
  const { authUser, getOneBlockedUser, unblockUser, subscribeToBlockEvents } = useAuthStore();
  const { theme } = useThemeStore();
  const messageEndRef = useRef(null);
  const containerRef = useRef(null);
  const prevSelectedUserIdRef = useRef(null);
  const isAtBottomRef = useRef(true);

  const pinnedMessage = messages.find(m => m.isPinned);
  const sortedMessages = useMemo(() => {
    // Avoid resorting on every render to keep typing smooth
    return [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [messages]);

  // Swipe back hook for mobile navigation
  useSwipeBack(() => setSelectedUser(null));

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchActiveId(null);
  }, [selectedUser?._id]);

  useEffect(() => {
    getMessages(selectedUser._id);
    // When switching chats, we want to force scroll to bottom on next messages load
    isAtBottomRef.current = true;
  }, [selectedUser._id, getMessages]);

  useEffect(() => {
    loadStarredIds();
  }, [loadStarredIds]);

  useEffect(() => {
    if (!selectedUser?._id) return;
    getPreference("dm", selectedUser._id).then((pref) => {
      if (pref?.wallpaper) setWallpaper(pref.wallpaper);
      else setWallpaper(getDefaultWallpaper());
    });
  }, [selectedUser?._id, getPreference]);

  useEffect(() => {
    const scrollId = sessionStorage.getItem("scrollToMessageId");
    if (!scrollId || isMessagesLoading) return;
    const t = setTimeout(() => {
      const el = containerRef.current?.querySelector(`[data-message-id="${scrollId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("highlight-message");
      setTimeout(() => el?.classList.remove("highlight-message"), 2500);
      sessionStorage.removeItem("scrollToMessageId");
    }, 300);
    return () => clearTimeout(t);
  }, [isMessagesLoading, messages.length, selectedUser?._id]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      // If the user is within 100px of the bottom, we consider them "at the bottom"
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
    }
  };

  const handleImageLoad = useCallback(() => {
    if (containerRef.current && isAtBottomRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  // Scroll to bottom IMMEDIATELY when messages change or typing status changes
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const isNewChat = selectedUser?._id !== prevSelectedUserIdRef.current;
    const lastMessage = sortedMessages[sortedMessages.length - 1];
    const isMyMessage = lastMessage?.senderId === authUser?._id;

    if (isNewChat) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      isAtBottomRef.current = true;
      prevSelectedUserIdRef.current = selectedUser?._id;
    } else if (isMyMessage || isAtBottomRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      isAtBottomRef.current = true;
    }
  }, [sortedMessages.length, selectedUser?._id, isTyping, authUser?._id]);


  // Optimized: Check blocked status with caching
  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Use cache if available and fresh (< 30 seconds old)
        const now = Date.now();
        if (blockedUsersCache.current && now - blockedUsersCache.current.timestamp < 30000) {
          setIsBlocked(blockedUsersCache.current.data.some(user => user._id === selectedUser._id));
        } else {
          const data = await getOneBlockedUser();
          blockedUsersCache.current = { data: data.blockedUsers, timestamp: now };
          setIsBlocked(data.blockedUsers.some(user => user._id === selectedUser._id));
        }
      } catch (error) {
        console.error("Error checking blocked status:", error);
      }
    };
    checkStatus();
  }, [selectedUser._id]);

  useEffect(() => {
    const unsubscribe = subscribeToBlockEvents(async ({ blockerId, blockedId }) => {
      if (authUser._id === blockerId || authUser._id === blockedId) {
        // Invalidate cache on block/unblock events
        blockedUsersCache.current = null;
        const data = await getOneBlockedUser();
        blockedUsersCache.current = { data: data.blockedUsers, timestamp: Date.now() };
        setIsBlocked(data.blockedUsers.some(user => user._id === selectedUser._id));
      }
    });
    return unsubscribe;
  }, [selectedUser._id, authUser._id, subscribeToBlockEvents]);

  const handleDeleteForEveryone = async (messageId) => {
    const socket = useAuthStore.getState().socket;
    if (!socket || !socket.connected) {
      toast.error("Socket not connected. Please refresh the page.");
      return;
    }
    await deleteForAllMessage(messageId);
    setDeletePopupMessageId(null);
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Text copied")).catch(() => toast.error("Failed to copy"));
  };

  const handleForwardClick = (messageId) => {
    setForwardPopupMessageId(messageId);
  };

  const handleForwardMessage = async (userId) => {
    setIsForwardLoading(true);
    try {
      await forwardMessage(forwardPopupMessageId, userId);
      setForwardPopupMessageId(null);
    } catch (error) {
      console.error("Error forwarding message:", error);
    } finally {
      setIsForwardLoading(false);
    }
  };

  const handelUnblockUser = async (userId) => {
    try {
      await unblockUser(userId);
      setIsBlocked(false);
    } catch (error) {
      setIsBlocked(true);
      toast.error("Failed to unblock user");
    }
  };

  const handleSendFriendRequest = async () => {
    try {
      await sendFriendRequest(selectedUser._id);
    } catch (error) {
      console.error("Error sending friend request:", error);
    }
  };

  const openMessageMenu = (messageId, el) => {
    setAnchorEl(el || null);
    setOpenMenuId(messageId);
  };

  const menuMessage = openMenuId
    ? sortedMessages.find((m) => m._id === openMenuId)
    : null;

  const menuActions = menuMessage
    ? buildPrivateChatActions({
        message: menuMessage,
        authUserId: authUser._id,
        isStarred: isStarred(menuMessage._id),
        onReply: () => setReplyingToMessage(menuMessage),
        onStar: () => toggleStar(menuMessage._id, "dm", selectedUser._id, isStarred(menuMessage._id)),
        onPin: () => togglePinMessage(menuMessage._id),
        onCopy: () => handleCopyText(menuMessage.text),
        onForward: () => handleForwardClick(menuMessage._id),
        onEdit: () => setEditingMessageId(menuMessage._id),
        onDelete: () => setDeletePopupMessageId(menuMessage._id),
        onDownload: async () => {
          try {
            const response = await fetch(menuMessage.image);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `image_${menuMessage._id}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          } catch {
            toast.error("Failed to download");
          }
        },
      })
    : [];

  if (!selectedUser.isFriend) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <UserPlus className="w-12 h-12 mx-auto text-primary mb-4" />
          <h3 className="text-xl font-bold mb-2">Not Friends Yet</h3>
          <p className="text-base-content/70 mb-4">You need to be friends with {selectedUser.fullName} to send messages.</p>
          {selectedUser.hasPendingRequest && selectedUser.pendingRequestSentByMe ? (
            <div className="text-sm text-base-content/60">Friend request sent.</div>
          ) : selectedUser.hasPendingRequest ? (
            <button onClick={() => window.location.href = '/notifications'} className="btn btn-primary gap-2"><Check className="w-4 h-4" /> Accept Friend Request</button>
          ) : (
            <button onClick={handleSendFriendRequest} className="btn btn-primary gap-2"><UserPlus className="w-4 h-4" /> Send Friend Request</button>
          )}
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <Ban className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h3 className="text-xl font-bold mb-2">You've blocked this user</h3>
          <button onClick={() => handelUnblockUser(selectedUser._id)} className="px-4 py-2 bg-red-500 text-white rounded-lg">Unblock User</button>
        </div>
      </div>
    );
  }

  const renderedMessages = useMemo(() => {
    return sortedMessages.map((message, index, sortedMessagesArr) => {
      const currentDateKey = getMessageDateKey(message.createdAt);
      const previousDateKey = index > 0 ? getMessageDateKey(sortedMessagesArr[index - 1].createdAt) : null;
      const showDateSeparator = currentDateKey !== previousDateKey;

      return (
        <div key={message.optimisticId || message._id}>
          {showDateSeparator && (
            <div className="flex justify-center my-4">
              <div className="bg-base-300/80 text-base-content/70 px-4 py-1.5 rounded-lg text-xs font-medium shadow-sm backdrop-blur-sm">{formatDateSeparator(message.createdAt)}</div>
            </div>
          )}

          {message.status === 'scheduled' && message.senderId === authUser._id && (
            <div className="text-center text-xs opacity-50 my-1">🕒 Scheduled for {new Date(message.scheduledFor || 0).toLocaleString()}</div>
          )}

          <div id={`msg-${message._id}`} data-message-id={message._id} className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"} ${searchActiveId === message._id ? "ring-2 ring-warning/60 rounded-xl" : ""}`} ref={messageEndRef} >
            <div className="chat-image avatar ml-2 md:ml-3">
              <div className="size-8 md:size-10 rounded-full border">
                <img src={message.senderId === authUser._id ? authUser.profilePic || defaultImg : selectedUser.profilePic || defaultImg} alt="profile pic" />
              </div>
            </div>
            <div className="chat-header mb-1 flex items-center gap-1">
              <time className="text-xs opacity-50 ml-1">{formatMessageTime(message.createdAt)}</time>
              {message.isEdited && <span className="text-[10px] opacity-40 italic">(edited)</span>}
            </div>

            <SwipeableMessageBubble
              isMine={message.senderId === authUser._id}
              disabled={message.text === "This message was deleted" || message.status === "scheduled"}
              onReply={() => setReplyingToMessage(message)}
              onLongPress={(el) => {
                haptic("longPress");
                openMessageMenu(message._id, el);
              }}
            >
            <DoubleTapLike
              disabled={
                message.senderId === authUser._id ||
                message.text === "This message was deleted"
              }
              onDoubleTap={() => sendReaction(message._id, "❤️")}
            >
            <div className={`chat-bubble flex flex-col relative group !max-w-none w-fit ${message.senderId === authUser._id ? 'chat-bubble-primary' : ''} ${message.status === 'scheduled' ? 'opacity-70 border-dashed border-2' : ''}`}>
              {message.replyToMessage && message.text !== "This message was deleted" && (
                <div className={`mb-2 p-2 rounded-lg bg-black/10 dark:bg-black/20 border-l-4 border-secondary cursor-pointer hover:bg-black/20 dark:hover:bg-black/30 transition-colors`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const element = document.getElementById(`msg-${message.replyTo}`);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      element.classList.add('highlight-message');
                      setTimeout(() => element.classList.remove('highlight-message'), 2000);
                    } else {
                      toast("Original message not loaded", { icon: '🔍' });
                    }
                  }}
                >
                  <p className="text-xs font-bold opacity-80 mb-0.5 text-secondary-content">{message.replyToMessage.senderId === authUser._id ? "You" : message.replyToMessage.senderName}</p>
                  <div className="flex items-center gap-2">
                    {message.replyToMessage.image && message.replyToMessage.text !== "This message was deleted" && <img src={message.replyToMessage.image} alt="Thumbnail" className="w-8 h-8 rounded object-cover" onLoad={handleImageLoad} />}
                    <p className="text-xs opacity-70 truncate max-w-[150px]">{message.replyToMessage.text || (message.replyToMessage.image ? "Photo" : "")}</p>
                  </div>
                </div>
              )}

              {message.image && (
                <img
                  src={message.image}
                  alt="Attachment"
                  className={`max-w-[200px] md:max-w-[280px] rounded-xl mb-2 ${message.image.toLowerCase().includes('.gif') ? '' : 'cursor-pointer hover:opacity-90'} transition-opacity`}
                  onClick={() => !message.image.toLowerCase().includes('.gif') && setPreviewImage(message.image)}
                  onLoad={handleImageLoad}
                />
              )}

              {message.video && (
                <VideoMessage
                  video={message.video}
                  thumbnail={message.videoThumbnail}
                  duration={message.videoDuration}
                  isMyMessage={message.senderId === authUser._id}
                />
              )}

              {message.audio && <AudioPlayer audioUrl={message.audio} isMyMessage={message.senderId === authUser._id} />}

              {message.file && (
                <div className="flex items-center gap-3 p-3 bg-base-100/10 rounded-xl my-1 border border-base-content/10">
                  <div className="p-2 bg-base-100/20 rounded-lg"><FileText size={20} /></div>
                  <div className="flex-1 min-w-0">
                    <a href={message.file} download={message.fileName || "download"} className="text-sm font-bold hover:underline truncate block">{message.fileName || "Attachment"}</a>
                    <span className="text-xs opacity-60">Click to download</span>
                  </div>
                  <a href={message.file} download={message.fileName || "download"} className="btn btn-circle btn-xs btn-ghost bg-base-100/20 hover:bg-base-100/30"><Download size={14} /></a>
                </div>
              )}

              {message.poll && message.poll.question && message.poll.options && Array.isArray(message.poll.options) && message.poll.options.length > 0 && (
                <div className="bg-base-100/10 p-3 rounded-xl my-1 w-full min-w-[220px] md:min-w-[260px] border border-base-content/10">
                  <h4 className="font-bold mb-3 flex items-center gap-2 text-sm">{message.poll.question}</h4>
                  <div className="space-y-2">
                    {message.poll.options.map((opt, i) => {
                      const totalVotes = message.poll.options.reduce((acc, o) => acc + (o.votes?.length || 0), 0);
                      const percent = totalVotes === 0 ? 0 : Math.round(((opt.votes?.length || 0) / totalVotes) * 100);
                      const isVoted = opt.votes?.includes(authUser._id) || false;
                      return (
                        <div key={i} className="relative cursor-pointer group" onClick={() => votePoll(message._id, i)}>
                          <div className="flex justify-between text-xs mb-1 font-medium">
                            <span className={isVoted ? 'text-secondary' : ''}>{opt.text} {isVoted && '✓'}</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="w-full h-2 bg-base-100/20 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-500 ease-out ${isVoted ? 'bg-secondary' : 'bg-base-content/50'}`} style={{ width: `${percent}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 text-xs opacity-60 flex justify-between"><span>{message.poll.options.reduce((acc, o) => acc + (o.votes?.length || 0), 0)} votes</span><span>Poll</span></div>
                </div>
              )}

              {message.text && !message.audio && (
                <div className="relative">
                  {message.isForwarded && message.text !== "This message was deleted" && (
                    <div className="forwarded-badge mb-1"><Forward className="w-3 h-3" /><span>Forwarded</span></div>
                  )}
                  <div className={`relative ${message.text === "This message was deleted" ? "opacity-50 italic" : ""} `} >
                    {editingMessageId === message._id ? (
                      <MessageEditField
                        initialText={message.text}
                        onSave={(newText) => {
                          editMessage(message._id, newText);
                          setEditingMessageId(null);
                        }}
                        onCancel={() => setEditingMessageId(null)}
                        isMyMessage={message.senderId === authUser._id}
                      />
                    ) : (
                      <p className="text-sm md:text-base whitespace-pre-wrap">
                        {searchQuery && message.text
                          ? highlightText(message.text, searchQuery, searchActiveId === message._id)
                          : message.text}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* New Reactions Display */}
              <MessageReactions messageId={message._id} reactions={message.reactions} senderId={message.senderId} />

              {/* Reaction Picker on Hover */}
              {message.text !== "This message was deleted" &&
                message.status !== 'scheduled' &&
                message.senderId !== authUser._id &&
                !message.reactions?.some(r => r.userId === authUser._id) && (
                  <div className={`absolute top-full mt-1 ${message.senderId === authUser._id ? 'right-0' : 'left-0'} 
                      hidden md:flex items-center gap-1 p-1 bg-base-100/90 backdrop-blur-sm rounded-full shadow-lg border border-base-200 
                      opacity-0 group-hover:opacity-100 transition-all duration-200 z-50`}
                  >
                    {['👍', '❤️', '😂', '😮', '😢', '😡'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={(e) => { e.stopPropagation(); sendReaction(message._id, emoji); }}
                        className="hover:scale-125 transition-transform px-1 text-sm"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

              {message.senderId === authUser._id && (
                <div className="status-container mt-1 self-end">
                  {message.status === "read" ? <CheckCheck className="w-4 h-4 tick-read message-status-icon text-blue-500" /> :
                    message.status === "delivered" ? <CheckCheck className="w-4 h-4 tick-delivered message-status-icon" /> :
                      message.status === "scheduled" ? <Clock className="w-3 h-3 opacity-50" /> :
                        <Check className="w-4 h-4 tick-sent message-status-icon" />}
                </div>
              )}

              {message.text !== "This message was deleted" && message.status !== 'scheduled' && (
                <MessageMenuTrigger
                  isMine={message.senderId === authUser._id}
                  onOpen={(el) => openMessageMenu(message._id, el)}
                />
              )}
            </div>
            </DoubleTapLike>
            </SwipeableMessageBubble>
          </div>
        </div>
      );
    });
  }, [sortedMessages, authUser, selectedUser, handleImageLoad, votePoll, sendReaction, editingMessageId, setReplyingToMessage, searchQuery, searchActiveId]);

  const wallpaperStyle = resolveWallpaperStyle(wallpaper);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-base-100">
      <div className="chat-topbar shrink-0">
        {searchOpen ? (
          <ChatSearchBar
            open={searchOpen}
            onOpenChange={setSearchOpen}
            messages={sortedMessages}
            containerRef={containerRef}
            onActiveMatchChange={setSearchActiveId}
            onSearchQueryChange={setSearchQuery}
          />
        ) : (
          <ChatHeader
            onWallpaperChange={setWallpaper}
            onSearchOpen={() => setSearchOpen(true)}
          />
        )}
      </div>

      {pinnedMessage && (
        <div className="bg-primary/5 p-2 flex items-center justify-between border-b border-base-200 cursor-pointer backdrop-blur-sm z-10" onClick={() => {
          const el = document.getElementById(`msg-${pinnedMessage._id}`);
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('highlight-message'); setTimeout(() => el.classList.remove('highlight-message'), 2000); }
        }}>
          <div className="flex items-center gap-2 text-xs overflow-hidden px-2">
            <Pin size={14} className="text-primary flex-shrink-0 fill-current" />
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold text-primary text-[10px] uppercase">Pinned Message</span>
              <span className="truncate max-w-[200px] opacity-80">{pinnedMessage.text || (pinnedMessage.image ? "Photo" : pinnedMessage.audio ? "Voice Message" : pinnedMessage.poll ? "Poll" : "Attachment")}</span>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); togglePinMessage(pinnedMessage._id); }} className="btn btn-ghost btn-xs btn-circle"><Ban className="w-3 h-3 text-base-content/50" /></button>
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 space-y-4 custom-scrollbar messages-container pb-4"
        style={wallpaperStyle.background ? { background: wallpaperStyle.background, backgroundSize: wallpaperStyle.backgroundSize, filter: wallpaperStyle.filter } : undefined}
      >
        {messages.length === 0 && !isMessagesLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4"><span className="text-4xl">👋</span></div>
            <h3 className="text-lg font-semibold text-base-content mb-2">Start a conversation</h3>
            <p className="text-sm text-base-content/60 max-w-xs">Say hi to {selectedUser.fullName}!</p>
          </div>
        )}

        {renderedMessages}

        {isTyping && (
          <div className="chat chat-start mb-2">
            <div className="chat-image avatar ml-2 md:ml-3">
              <div className="size-8 md:size-10 rounded-full border">
                <img src={selectedUser.profilePic || defaultImg} alt="profile pic" />
              </div>
            </div>
            <div className="chat-bubble bg-base-200 text-base-content px-4 py-2 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-base-content/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-base-content/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-base-content/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messageEndRef} />
      </div>

      <div className="chat-composer-spacer md:hidden" aria-hidden />
      <MessageInput />

      <MessageActionMenu
        open={!!menuMessage}
        onClose={() => setOpenMenuId(null)}
        anchorEl={anchorEl}
        isMine={menuMessage?.senderId === authUser._id}
        actions={menuActions}
        showReactions={
          !!menuMessage &&
          menuMessage.senderId !== authUser._id &&
          !menuMessage.reactions?.some((r) => r.userId === authUser._id)
        }
        onReact={(emoji) => menuMessage && sendReaction(menuMessage._id, emoji)}
      />

      {/* Delete Dialog */}
      <Dialog
        open={!!deletePopupMessageId}
        onClose={() => setDeletePopupMessageId(null)}
        PaperProps={{ sx: { borderRadius: "16px", width: "90%", maxWidth: "400px" } }}
      >
        <div className="px-5 pt-3">
          <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 700, px: 0, py: 1 }}>
            Delete message?
          </DialogTitle>
          <DialogContent sx={{ px: 0, py: 1 }}>
            <Typography variant="body2" color="text.secondary">
              This action cannot be undone.
            </Typography>
          </DialogContent>
        </div>
        <DialogActions sx={{ flexDirection: "column", gap: 1, px: 3, pb: 3, pt: 0 }}>
          <Button
            fullWidth
            variant="contained"
            color="error"
            onClick={() => {
              handleDeleteForEveryone(deletePopupMessageId);
              setDeletePopupMessageId(null);
            }}
            sx={{ py: 1.5, borderRadius: "10px", fontWeight: 600 }}
          >
            Delete for everyone
          </Button>
          <Button
            fullWidth
            variant="text"
            onClick={() => setDeletePopupMessageId(null)}
            sx={{ py: 1.5, borderRadius: "10px" }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Forward Dialog */}
      <Dialog
        open={!!forwardPopupMessageId}
        onClose={() => setForwardPopupMessageId(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: "16px" } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Forward size={20} />
          <span>Forward Message</span>
        </DialogTitle>
        <Divider />
        <div>
          <TextField
            placeholder="Search contacts..."
            variant="outlined"
            size="small"
            sx={{
              mx: 2,
              mb: 1,
              mt: 2,
              width: "94%",
              "& .MuiOutlinedInput-root": { borderRadius: "20px" },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} color="#64748b" />
                </InputAdornment>
              ),
            }}
          />
        </div>
        <DialogContent>
          <List sx={{ width: "100%" }}>
            {users
              .filter((user) => user._id !== authUser._id)
              .map((user) => (
                <ListItem
                  key={user._id}
                  button
                  onClick={() => handleForwardMessage(user._id)}
                  sx={{
                    "&:hover": { backgroundColor: "rgba(99, 102, 241, 0.08)" },
                    borderRadius: "8px",
                    py: 1.5,
                    px: 2,
                    mb: 0.5,
                  }}
                >
                  <ListItemAvatar>
                    <Avatar src={user.profilePic || defaultImg} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" fontWeight={500}>
                        {user.fullName}
                      </Typography>
                    }
                    secondary={user.email}
                    sx={{ ml: 1 }}
                  />
                  <Box
                    sx={{
                      opacity: 0,
                      transition: "opacity 0.2s",
                      "li:hover &": { opacity: 1 },
                    }}
                  >
                    <Forward size={18} color="#94a3b8" />
                  </Box>
                </ListItem>
              ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setForwardPopupMessageId(null)}
            sx={{ borderRadius: "8px", px: 3 }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => { setPreviewImage(null); setImageZoom(1); }}
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.1 : -0.1;
            setImageZoom(prev => Math.min(Math.max(prev + delta, 0.5), 3));
          }}
        >
          {/* Close Button */}
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
            onClick={() => { setPreviewImage(null); setImageZoom(1); }}
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Top Center Controls - Zoom */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 z-10">
            <button
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
              onClick={(e) => { e.stopPropagation(); setImageZoom(prev => Math.max(prev - 0.25, 0.5)); }}
            >
              <ZoomOut className="w-5 h-5 text-white" />
            </button>
            <span className="text-white text-sm font-medium min-w-[50px] text-center">{Math.round(imageZoom * 100)}%</span>
            <button
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
              onClick={(e) => { e.stopPropagation(); setImageZoom(prev => Math.min(prev + 0.25, 3)); }}
            >
              <ZoomIn className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Download Button */}
          <button
            className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10 flex items-center gap-2"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const response = await fetch(previewImage);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `image_${Date.now()}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
              } catch (error) {
                toast.error("Failed to download");
              }
            }}
          >
            <Download className="w-5 h-5 text-white" />
            <span className="text-white text-sm hidden md:inline">Download</span>
          </button>

          {/* Image Container */}
          <div
            className="flex items-center justify-center animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage}
              alt="Preview"
              className="rounded-lg shadow-2xl transition-transform duration-200 ease-out"
              style={{
                transform: `scale(${imageZoom})`,
                maxWidth: '90vw',
                maxHeight: '90vh',
                objectFit: 'contain',
                cursor: imageZoom > 1 ? 'zoom-out' : 'zoom-in'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
export default ChatContainer;
