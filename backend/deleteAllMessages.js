// Script to delete all messages from the database
// Run this file with: node deleteAllMessages.js

import fetch from 'node-fetch';

const API_URL = 'http://localhost:5001/api/messages/delete-all';

async function deleteAllMessages() {
    try {
        console.log('🗑️  Starting deletion of all messages...');
        console.log('API URL:', API_URL);

        const response = await fetch(API_URL, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-confirm-delete': 'YES_DELETE_ALL'
            }
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Success!');
            console.log(`Deleted ${data.deletedCount} messages from the database`);
        } else {
            console.error('❌ Error:', data.error || data.message);
        }
    } catch (error) {
        console.error('❌ Error deleting messages:', error.message);
    }
}

// Run the delete function
deleteAllMessages();
