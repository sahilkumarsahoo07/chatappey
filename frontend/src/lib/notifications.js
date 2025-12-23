// Notification utility for chat messages

// Request notification permission
export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.log("❌ This browser does not support notifications");
    return false;
  }

  console.log("Current notification permission:", Notification.permission);

  if (Notification.permission === "granted") {
    console.log("✅ Notification permission already granted");
    return true;
  }

  if (Notification.permission !== "denied") {
    console.log("🔔 Requesting notification permission...");
    try {
      const permission = await Notification.requestPermission();
      console.log("🔔 Permission result:", permission);

      if (permission === "granted") {
        // Test notification
        console.log("✅ Testing notification...");
        new Notification("ChatAppey Notifications Enabled!", {
          body: "You will now receive message and call notifications",
          icon: "/avatar.png",
        });
      }

      return permission === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }

  console.log("❌ Notification permission denied");
  return false;
};

// Show browser notification (when tab is not focused)
export const showBrowserNotification = (title, options = {}) => {
  console.log("=== showBrowserNotification called ===");
  console.log("Title:", title);
  console.log("Options:", options);
  console.log("Notification permission:", Notification.permission);
  console.log("Document visibility:", document.visibilityState);
  console.log("Document hidden:", document.hidden);

  if (Notification.permission !== "granted") {
    console.error("❌ Cannot show notification - permission not granted");
    console.log("Current permission:", Notification.permission);
    return null;
  }

  try {
    console.log("✅ Creating browser notification...");
    const notification = new Notification(title, {
      icon: "/avatar.png",
      badge: "/avatar.png",
      requireInteraction: true, // Keep notification until user interacts by default
      ...options,
    });

    console.log("✅ Notification created successfully");

    // Do not auto-close browser notifications. Let the OS/User handle it.
    // This allows notifications to sit in the action center if missed.
    // setTimeout(() => notification.close(), 5000); 

    return notification;
  } catch (error) {
    console.error("❌ Error creating notification:", error);
    return null;
  }
};

// Show in-app notification (when tab is focused but viewing different chat)
export const showInAppNotification = (message, sender, onClick) => {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = "in-app-notification";
  notification.innerHTML = `
    <div class="flex items-center gap-3 p-4 bg-base-100 rounded-lg shadow-xl border border-base-300 cursor-pointer hover:shadow-2xl transition-all">
      <img src="${sender.profilePic || '/avatar.png'}" alt="${sender.fullName}" class="w-12 h-12 rounded-full object-cover border-2 border-primary" />
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-base-content truncate">${sender.fullName}</p>
        <p class="text-sm text-base-content/70 truncate">${message.text || '📷 Photo'}</p>
      </div>
    </div>
  `;

  // Position it at top-right
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    animation: slideInRight 0.3s ease-out;
    max-width: 350px;
  `;

  // Add click handler
  notification.onclick = () => {
    if (onClick) onClick();
    notification.remove();
  };

  // Add to DOM
  document.body.appendChild(notification);

  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.3s ease-in";
    setTimeout(() => notification.remove(), 300);
  }, 5000);

  return notification;
};

// Play notification sound
export const playNotificationSound = () => {
  const audio = new Audio("/notification.mp3"); // Add notification sound to public folder
  audio.volume = 0.5;
  audio.play().catch((err) => console.log("Could not play sound:", err));
};

// Check if document is visible
export const isDocumentVisible = () => {
  return document.visibilityState === "visible";
};

// Add CSS animations
const style = document.createElement("style");
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }

  .in-app-notification {
    font-family: inherit;
  }
`;
document.head.appendChild(style);
