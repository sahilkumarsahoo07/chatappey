import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import defaultImg from "../public/avatar.png";
import { Ban, CheckCheck, Download, Forward, MoreVertical, Search,} from "lucide-react";
import { Menu, MenuItem, Dialog, DialogTitle, DialogActions, Button, Typography, DialogContent, Avatar, List, ListItem, ListItemAvatar, ListItemText, Divider, Box, InputAdornment, TextField,} from "@mui/material";
import toast from "react-hot-toast";

const ChatContainer = () => {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deletePopupMessageId, setDeletePopupMessageId] = useState(null);
  const [forwardPopupMessageId, setForwardPopupMessageId] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isForwardLoading, setIsForwardLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const {messages, getMessages, isMessagesLoading, selectedUser, subscribeToMessages, unsubscribeFromMessages, deleteForAllMessage, users,forwardMessage, } = useChatStore();
  const { authUser,getOneBlockedUser,unblockUser,subscribeToBlockEvents  } = useAuthStore();
  const messageEndRef = useRef(null);

  useEffect(() => {
    getMessages(selectedUser._id);

    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [
    selectedUser._id,
    getMessages,
    subscribeToMessages,
    unsubscribeFromMessages,
  ]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);


    useEffect(() => {
        const checkStatus = async () => {
            const blocked = await getOneBlockedUser().then(data => 
                data.blockedUsers.some(user => user._id === selectedUser._id)
            );
            setIsBlocked(blocked);
        };
        checkStatus();
    }, [selectedUser._id]);

    // Listen for block/unblock events
    useEffect(() => {
        const unsubscribe = subscribeToBlockEvents(async ({ blockerId, blockedId }) => {
            if (authUser._id === blockerId || authUser._id === blockedId) {
                const blocked = await getOneBlockedUser().then(data => 
                    data.blockedUsers.some(user => user._id === selectedUser._id)
                );
                setIsBlocked(blocked);
            }
        });
        return unsubscribe;
    }, [selectedUser._id, authUser._id, subscribeToBlockEvents]);


   useEffect(() => {
        const checkBlockedStatus = async () => {
            try {
                const data = await getOneBlockedUser(); // Call the function and store the result
                setIsBlocked(data.blockedUsers.some(user => user._id === selectedUser._id)); // Use the result
            } catch (error) {
                console.error("Error checking blocked status:", error);
            }
        };

        checkBlockedStatus();
    }, [selectedUser._id]);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

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
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success("Text copied to clipboard");
      })
      .catch((err) => {
        console.error("Error copying text: ", err);
        toast.error("Failed to copy text");
      });
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

 const handelUnblockUser = async(userId) => {
  try {
    await unblockUser(userId);
    setIsBlocked(false);
  } catch (error) {
    console.error("Error unblocking user:", error);
    setIsBlocked(true);
    toast.error(error.response?.data?.message || "Failed to unblock user");
  } finally {
  }
};
  

   if (isBlocked) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <Ban className="w-12 h-12 mx-auto text-red-500 mb-4" />
                    <h3 className="text-xl font-bold mb-2">You've blocked this user</h3>
                    <p className="text-gray-600 mb-4">
                        You won't receive new messages from {selectedUser.fullName}. 
                        Unblock them to resume messaging.
                    </p>
                    <button 
                        onClick={() => handelUnblockUser(selectedUser._id)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors" >
                        Unblock User
                    </button>
                </div>
            </div>
        );
    }


  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {[...messages]
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          .map((message) => (
            <div key={message._id} className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"}`} ref={messageEndRef} >
              <div className=" chat-image avatar ml-3">
                <div className="size-10 rounded-full border">
                  <img src={ message.senderId === authUser._id ? authUser.profilePic || defaultImg : selectedUser.profilePic || defaultImg } alt="profile pic" />
                </div>
              </div>
              <div className="chat-header mb-1">
                <time className="text-xs opacity-50 ml-1">
                  {formatMessageTime(message.createdAt)}
                </time>
              </div>

              <div className="chat-bubble flex flex-col relative group">
                {message.image && ( <img src={message.image} alt="Attachment" className="sm:max-w-[200px] rounded-md mb-2" /> )}           
              {message.text && (
                    <div className="relative">
                        {/* Show "Forwarded" only if it's forwarded AND not deleted */}
                        {message.isForwarded && message.text !== "This message was deleted" && (
                        <div className="flex items-center text-xs text-gray-500 mb-1">
                            <Forward className="w-3 h-3 mr-1" />
                            <span>Forwarded</span>
                        </div>
                        )}
                        <div className={`relative ${message.text === "This message was deleted" ? "text-gray-500 italic" : ""} ${message.isForwarded && message.text !== "This message was deleted" ? "bg-gray-50 rounded-lg p-2 border-l-4 border-blue-200" : ""} `} >
                        <p>{message.text}</p>
                        </div>
                    </div>
                )}


                {/* ✅ Double Tick Icon */}
                {message.senderId === authUser._id && (
                  <div className={`absolute bottom-0 right-0 ${message.status === "seen" ? "text-green-600" : "text-blue-500"}`} >
                    <CheckCheck className="w-4 h-4" />
                  </div>
                )}

                {/* 3-dot menu button */}
                {message.text !== "This message was deleted" && (
                  <>
                    <button className="absolute top-0 p-1 opacity-0 group-hover:opacity-100" style={{ right: "-23px" }} onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); setOpenMenuId(message._id); }} >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* MUI Menu */}
                    <Menu anchorEl={anchorEl}
                      open={openMenuId === message._id}
                      onClose={() => setOpenMenuId(null)}
                      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                      transformOrigin={{ vertical: "top", horizontal: "right" }}
                      PaperProps={{ sx: { width: 200 } }} >
                      {!message.image && (
                        <MenuItem onClick={() => { handleCopyText(message.text); setOpenMenuId(null); }} >
                          📋 Copy
                        </MenuItem>
                      )}
                      <MenuItem onClick={() => { setOpenMenuId(null); handleForwardClick(message._id); }} >
                        📤 Forward
                      </MenuItem>
                      {message.senderId === authUser._id && (
                        <MenuItem sx={{ color: "error.main" }} onClick={() => { setOpenMenuId(null); setDeletePopupMessageId(message._id); }} >
                          🗑️ Delete
                        </MenuItem>
                      )}
                      {message.image && (
                        <MenuItem
                          onClick={async () => {
                            try {
                              // Fetch the image first
                              const response = await fetch(message.image);
                              const blob = await response.blob();

                              // Create a download link
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement("a");
                              link.href = url;
                              link.download = `message_image_${message._id}.jpg`; // or .png based on your image type

                              // Append to DOM, click and remove
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);

                              // Clean up by revoking the object URL
                              window.URL.revokeObjectURL(url);

                              setOpenMenuId(null);
                            } catch (error) {
                              console.error("Error downloading image:", error);
                              toast.error("Failed to download image");
                            }
                          }}
                        >
                          <Download className="mr-2" />
                          {/* 📥  */}
                          Download Image
                        </MenuItem>
                      )}
                    </Menu>

                    {/* Delete confirmation dialog */}

                    <Dialog
                      open={deletePopupMessageId === message._id}
                      onClose={() => setDeletePopupMessageId(null)}
                      PaperProps={{
                        sx: {
                          borderRadius: "12px",
                          width: "90%",
                          maxWidth: "400px",
                          "& .MuiDialogTitle-root .MuiIconButton-root": {
                            display: "none",
                          },
                        },
                      }}
                    >
                      <div className="px-5 pt-3">
                        <DialogTitle
                          sx={{
                            fontSize: "1.25rem",
                            fontWeight: 700,
                            px: 0,
                            py: 1,
                            color: "text.primary",
                          }}
                        >
                          Delete message?
                        </DialogTitle>
                        <DialogContent sx={{ px: 0, py: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            This action cannot be undone.
                          </Typography>
                        </DialogContent>
                      </div>

                      <DialogActions
                        sx={{
                          flexDirection: "column",
                          gap: 1,
                          px: 3,
                          pb: 3,
                          pt: 0,
                        }}
                      >
                        {message.senderId === authUser._id && (
                          <Button
                            fullWidth
                            variant="contained"
                            color="error"
                            size="medium"
                            onClick={() => {
                              handleDeleteForEveryone(message._id);
                              setDeletePopupMessageId(null);
                            }}
                            sx={{
                              py: 1.5,
                              borderRadius: "8px",
                              fontWeight: 600,
                              "&:hover": {
                                backgroundColor: "error.dark",
                              },
                            }}
                          >
                            Delete for everyone
                          </Button>
                        )}

                        <Button
                          fullWidth
                          variant="text"
                          size="medium"
                          onClick={() => setDeletePopupMessageId(null)}
                          sx={{
                            py: 1.5,
                            borderRadius: "8px",
                            color: "text.primary",
                            "&:hover": {
                              backgroundColor: "action.hover",
                            },
                          }}
                        >
                          Cancel
                        </Button>
                      </DialogActions>
                    </Dialog>

                    {/* Forward Message popup  */}
                    <Dialog
                      open={forwardPopupMessageId === message._id}
                      onClose={() => setForwardPopupMessageId(null)}
                      fullWidth
                      maxWidth="sm"
                      PaperProps={{
                        sx: { borderRadius: "12px" },
                      }}
                    >
                      <DialogTitle
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Forward size={20} />
                        <span>Forward Message</span>
                      </DialogTitle>
                      <Divider />
                      <div sx={{ px: 3, py: 2 }}>
                        <TextField
                          placeholder="Search contacts..."
                          variant="outlined"
                          size="small"
                          sx={{
                            mx: 2,
                            mb: 1,
                            mt: 2,
                            width: "94%",
                            "& .MuiOutlinedInput-root": {
                              borderRadius: "20px",
                              backgroundColor: "background.paper",
                              "& fieldset": {
                                borderColor: "divider",
                              },
                              "&:hover fieldset": {
                                borderColor: "primary.light",
                              },
                            },
                            "& .MuiInputBase-input": {
                              py: 1.2,
                              px: 2,
                            },
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
                                "&:hover": {
                                    backgroundColor: "rgba(99, 102, 241, 0.08)",
                                },
                                borderRadius: "8px",
                                py: 1.5,
                                px: 2,
                                mb: 0.5,
                                transition: "all 0.2s ease",
                                }}
                            >
                                <ListItemAvatar>
                                <Avatar
                                    src={user.profilePic || defaultImg}
                                    alt={user.fullName}
                                    sx={{ 
                                    width: 40, 
                                    height: 40,
                                    border: "2px solid #e2e8f0"
                                    }}
                                />
                                </ListItemAvatar>
                                <ListItemText
                                primary={
                                    <Typography 
                                    variant="subtitle1" 
                                    sx={{ 
                                        fontWeight: 500,
                                        color: "text.primary"
                                    }}
                                    >
                                    {user.fullName}
                                    </Typography>
                                }
                                secondary={
                                    <Typography 
                                    variant="body2" 
                                    sx={{ 
                                        color: "text.secondary",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.5
                                    }}
                                    >
                                    <span>{user.email}</span>
                                    </Typography>
                                }
                                sx={{ ml: 1 }}
                                />
                                <Box sx={{ 
                                opacity: 0,
                                transition: "opacity 0.2s ease",
                                "li:hover &": {
                                    opacity: 1
                                }
                                }}>
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
                  </>
                )}
              </div>
            </div>
          ))}
      </div>

      <MessageInput />
    </div>
  );
};
export default ChatContainer;
