import { useEffect, useState } from 'react';
import { useCallStore } from '../store/useCallStore';
import { useAuthStore } from '../store/useAuthStore';
import CallHistoryItem from '../components/CallHistoryItem';
import { Phone, Search, ChevronDown } from 'lucide-react';
import { Loader } from 'lucide-react';

const CallHistoryPage = () => {
    const { authUser } = useAuthStore();
    const { callHistory, fetchCallHistory, isLoadingHistory } = useCallStore();
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);

    useEffect(() => {
        if (authUser) {
            fetchCallHistory(filter);
        }
    }, [authUser, filter, fetchCallHistory]);

    // Filter calls based on search query
    const filteredCalls = callHistory?.filter(call => {
        const otherUser = call.receiver._id === authUser._id ? call.caller : call.receiver;
        return otherUser.fullName.toLowerCase().includes(searchQuery.toLowerCase());
    }) || [];

    const filterOptions = [
        { value: 'all', label: 'All' },
        { value: 'incoming', label: 'Incoming' },
        { value: 'outgoing', label: 'Outgoing' },
        { value: 'missed', label: 'Missed' }
    ];

    return (
        <div className="h-[100dvh] bg-base-200 pl-0 md:pl-20 pb-14 md:pb-0">
            <div className="h-full w-full bg-base-100 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-base-300 bg-base-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Phone className="w-6 h-6 text-primary" />
                            </div>
                            <h1 className="text-2xl font-bold text-base-content">Call History</h1>
                        </div>

                        {/* Filter Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary-focus transition-colors"
                            >
                                <span>{filterOptions.find(opt => opt.value === filter)?.label}</span>
                                <ChevronDown className="w-4 h-4" />
                            </button>

                            {showFilterDropdown && (
                                <div className="absolute right-0 mt-2 w-40 bg-base-100 border border-base-300 rounded-lg shadow-lg z-10">
                                    {filterOptions.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => {
                                                setFilter(option.value);
                                                setShowFilterDropdown(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 hover:bg-base-200 transition-colors first:rounded-t-lg last:rounded-b-lg ${filter === option.value ? 'bg-base-200 font-semibold' : ''
                                                }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-base-content/40" />
                        <input
                            type="text"
                            placeholder="Type a name"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-base-200 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Call History List */}
                <div className="flex-1 overflow-y-auto">
                    {isLoadingHistory ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader className="w-10 h-10 animate-spin text-primary" />
                        </div>
                    ) : filteredCalls.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6">
                            <div className="p-4 bg-base-200 rounded-full mb-4">
                                <Phone className="w-12 h-12 text-base-content/40" />
                            </div>
                            <h3 className="text-lg font-semibold text-base-content mb-2">
                                {searchQuery ? 'No calls found' : 'No call history'}
                            </h3>
                            <p className="text-base-content/60">
                                {searchQuery
                                    ? 'Try searching for a different name'
                                    : 'Your call history will appear here'}
                            </p>
                        </div>
                    ) : (
                        <div className="p-2">
                            {filteredCalls.map((call) => (
                                <CallHistoryItem key={call._id} call={call} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CallHistoryPage;
