import { useState, useRef, useEffect, memo, useMemo, useCallback } from 'react';
import {
    Clock,
    Smile,
    Leaf,
    Utensils,
    Activity,
    Plane,
    Lightbulb,
    Heart,
    Flag,
    Search,
    X,
    Loader2
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import emojiData from '@emoji-mart/data';

// ---------------------------------------------------------
// Static data processing done ONCE at module load
// ---------------------------------------------------------
const emojiMap = emojiData.emojis;

// Map categories to user-friendly titles and icons
const CATEGORY_META = {
    recent: { label: 'Recent', icon: Clock },
    people: { label: 'Smileys & People', icon: Smile },
    nature: { label: 'Animals & Nature', icon: Leaf },
    foods: { label: 'Food & Drink', icon: Utensils },
    activity: { label: 'Activities', icon: Activity },
    places: { label: 'Travel & Places', icon: Plane },
    objects: { label: 'Objects', icon: Lightbulb },
    symbols: { label: 'Symbols', icon: Heart },
    flags: { label: 'Flags', icon: Flag },
};

// Build standard category list from emoji-mart-data structure
const STANDARD_CATEGORIES = emojiData.categories.map(cat => ({
    id: cat.id,
    label: CATEGORY_META[cat.id]?.label || cat.id,
    emojis: cat.emojis.map(id => emojiMap[id]).filter(Boolean)
}));

// Build static search index for instant filtering
const searchIndex = Object.keys(emojiMap).map(id => {
    const emoji = emojiMap[id];
    const keywords = emoji.keywords || [];
    const searchString = [
        id.toLowerCase(),
        (emoji.name || '').toLowerCase(),
        ...keywords.map(k => k.toLowerCase())
    ].join(' ');

    return {
        id,
        name: emoji.name,
        skins: emoji.skins,
        searchString
    };
});

// Skin tone options
const SKIN_TONES = [
    { name: 'Default', emoji: '👋' },
    { name: 'Light', emoji: '👋🏻' },
    { name: 'Medium-Light', emoji: '👋🏼' },
    { name: 'Medium', emoji: '👋🏽' },
    { name: 'Medium-Dark', emoji: '👋🏾' },
    { name: 'Dark', emoji: '👋🏿' },
];

const EmojiPickerComponent = ({ onEmojiSelect }) => {
    const [showPicker, setShowPicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSkinToneDropdown, setShowSkinToneDropdown] = useState(false);
    const [hoveredEmoji, setHoveredEmoji] = useState(null);

    const pickerRef = useRef(null);
    const scrollContainerRef = useRef(null);

    // 1. Persisted Skin Tone State
    const [selectedSkinTone, setSelectedSkinTone] = useState(() => {
        try {
            const saved = localStorage.getItem('emoji-skin-tone');
            return saved !== null ? parseInt(saved, 10) : 0;
        } catch {
            return 0;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('emoji-skin-tone', selectedSkinTone.toString());
        } catch (e) {
            console.error('Error saving skin tone:', e);
        }
    }, [selectedSkinTone]);

    // 2. Persisted Recent Emojis State (stored as array of IDs)
    const [recentEmojiIds, setRecentEmojiIds] = useState(() => {
        try {
            const saved = localStorage.getItem('recent-emojis');
            return saved !== null ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // 3. Computed active categories (including recents if any)
    const categories = useMemo(() => {
        if (recentEmojiIds.length === 0) return STANDARD_CATEGORIES;

        const recentCategory = {
            id: 'recent',
            label: 'Recent',
            emojis: recentEmojiIds.map(id => emojiMap[id]).filter(Boolean)
        };

        return [recentCategory, ...STANDARD_CATEGORIES];
    }, [recentEmojiIds]);

    // 4. Local Search filtering
    const searchResults = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return [];

        const terms = query.split(/\s+/);
        return searchIndex.filter(emoji =>
            terms.every(term => emoji.searchString.includes(term))
        );
    }, [searchQuery]);

    // 5. Flatten structure into Rows for virtualization
    const rows = useMemo(() => {
        const result = [];
        if (searchQuery.trim() !== '') {
            // Flat list grouped in rows of 8 for search
            const chunkSize = 8;
            for (let i = 0; i < searchResults.length; i += chunkSize) {
                const chunk = searchResults.slice(i, i + chunkSize);
                result.push({
                    type: 'row',
                    id: `search-row-${i}`,
                    categoryId: 'search',
                    emojis: chunk
                });
            }
            return result;
        }

        // Standard category rows
        categories.forEach(category => {
            // Header Row
            result.push({
                type: 'header',
                id: category.id,
                label: category.label
            });

            // Grid Rows (8 emojis per row)
            const chunkSize = 8;
            for (let i = 0; i < category.emojis.length; i += chunkSize) {
                const chunk = category.emojis.slice(i, i + chunkSize);
                result.push({
                    type: 'row',
                    id: `${category.id}-row-${i}`,
                    categoryId: category.id,
                    emojis: chunk
                });
            }
        });

        return result;
    }, [categories, searchQuery, searchResults]);

    // 6. Active category tab navigation state
    const [activeTab, setActiveTab] = useState(() => {
        return recentEmojiIds.length > 0 ? 'recent' : 'people';
    });

    // Reset active category on search query change or reset
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setActiveTab(recentEmojiIds.length > 0 ? 'recent' : 'people');
        }
    }, [searchQuery, recentEmojiIds]);

    // 7. Virtualization setup
    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: useCallback((index) => {
            return rows[index]?.type === 'header' ? 36 : 40;
        }, [rows]),
        overscan: 6
    });

    // 8. Auto-update Active Tab during scroll
    const virtualItems = virtualizer.getVirtualItems();
    useEffect(() => {
        if (virtualItems.length > 0 && searchQuery.trim() === '') {
            const firstVisible = virtualItems[0];
            const row = rows[firstVisible.index];
            if (row) {
                const catId = row.type === 'header' ? row.id : row.categoryId;
                if (catId && catId !== activeTab) {
                    setActiveTab(catId);
                }
            }
        }
    }, [virtualItems, rows, activeTab, searchQuery]);

    // 9. Close Picker on Click Outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!document.contains(event.target)) return;
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setShowPicker(false);
                setShowSkinToneDropdown(false);
            }
        };

        if (showPicker) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [showPicker]);

    // 10. Actions
    const handleEmojiClick = useCallback((emoji) => {
        const nativeEmoji = emoji.skins[selectedSkinTone]?.native || emoji.skins[0].native;
        onEmojiSelect(nativeEmoji);

        // Update recently used emojis (max 30)
        setRecentEmojiIds((prev) => {
            const updated = [emoji.id, ...prev.filter(id => id !== emoji.id)].slice(0, 30);
            try {
                localStorage.setItem('recent-emojis', JSON.stringify(updated));
            } catch (e) {
                console.error('Error saving recent emojis:', e);
            }
            return updated;
        });
        setShowPicker(false);
        setShowSkinToneDropdown(false);
        setSearchQuery('');
    }, [onEmojiSelect, selectedSkinTone]);

    const handleTabClick = useCallback((catId) => {
        // Find row index of the category header
        const targetIndex = rows.findIndex(row => row.type === 'header' && row.id === catId);
        if (targetIndex !== -1) {
            setActiveTab(catId);
            virtualizer.scrollToIndex(targetIndex, { align: 'start' });
        }
    }, [rows, virtualizer]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && searchResults.length > 0) {
            handleEmojiClick(searchResults[0]);
            e.preventDefault();
        }
    }, [searchResults, handleEmojiClick]);

    const activeSkinEmoji = useMemo(() => {
        return SKIN_TONES[selectedSkinTone]?.emoji || '👋';
    }, [selectedSkinTone]);

    return (
        <div className="relative emoji-picker-wrapper" ref={pickerRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setShowPicker(!showPicker)}
                className={`p-1.5 rounded-full transition-colors duration-200 cursor-pointer ${showPicker
                    ? 'text-primary bg-primary/10'
                    : 'text-base-content/60 hover:bg-base-300 hover:text-base-content'
                    }`}
                title="Add emoji"
            >
                <Smile className="w-[22px] h-[22px]" />
            </button>

            {/* Picker Popup */}
            {showPicker && (
                <div
                    className="fixed bottom-[76px] left-4 right-4 sm:absolute sm:bottom-full sm:left-0 sm:right-auto sm:w-[350px] sm:mb-2 z-50 h-[400px] bg-base-100 rounded-2xl shadow-2xl border border-base-300 overflow-hidden flex flex-col emoji-picker-container transition-all"
                >
                    {/* 1. Category Tabs */}

                    {/* 3. Virtualized List */}
                    <div
                        ref={scrollContainerRef}
                        className="flex-grow overflow-y-auto px-2 select-none min-h-0 bg-base-100"
                    >
                        {searchQuery.trim() !== '' && searchResults.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-base-content/40 py-8">
                                <p className="text-sm font-medium">No emojis found</p>
                                <p className="text-xs">Try searching for something else</p>
                            </div>
                        ) : (
                            <div
                                style={{
                                    height: `${virtualizer.getTotalSize()}px`,
                                    width: '100%',
                                    position: 'relative'
                                }}
                            >
                                {virtualItems.map((vi) => {
                                    const row = rows[vi.index];
                                    if (!row) return null;

                                    return (
                                        <div
                                            key={vi.key}
                                            data-index={vi.index}
                                            ref={virtualizer.measureElement}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                transform: `translateY(${vi.start}px)`
                                            }}
                                        >
                                            {row.type === 'header' ? (
                                                <div className="flex items-center px-1 text-xs font-semibold uppercase tracking-wider text-base-content/40 h-[36px] bg-base-100 select-none">
                                                    {row.label}
                                                </div>
                                            ) : (
                                                <div className="flex items-center w-full justify-between h-[40px] px-0.5">
                                                    {row.emojis.map((emoji) => {
                                                        const nativeEmoji = emoji.skins[selectedSkinTone]?.native || emoji.skins[0].native;
                                                        return (
                                                            <button
                                                                key={emoji.id}
                                                                type="button"
                                                                onClick={() => handleEmojiClick(emoji)}
                                                                onMouseEnter={() => setHoveredEmoji(emoji)}
                                                                onMouseLeave={() => setHoveredEmoji(null)}
                                                                className="w-10 h-10 flex items-center justify-center text-[22px] hover:bg-base-300/80 rounded-xl transition-all duration-75 cursor-pointer select-none active:scale-90"
                                                                title={emoji.name}
                                                            >
                                                                {nativeEmoji}
                                                            </button>
                                                        );
                                                    })}
                                                    {/* Empty padding blocks */}
                                                    {Array.from({ length: 8 - row.emojis.length }).map((_, i) => (
                                                        <div key={`empty-${i}`} className="w-10 h-10" />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>


                    {/* 2. Search & Skin Tone Row */}
                    <div className="flex items-center gap-2 p-2 border-b border-base-300 bg-base-100 shrink-0">
                        <div className="relative flex-grow">
                            <input
                                type="text"
                                placeholder="Search emojis..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="input input-bordered input-sm w-full pl-8 pr-8 focus:outline-none text-sm bg-base-200/50 focus:bg-base-100 rounded-xl"
                            />
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:text-base-content"
                                >
                                    <X className="w-4 h-4 text-base-content/40 hover:text-base-content" />
                                </button>
                            )}
                        </div>

                        {/* Skin Tone Selector */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowSkinToneDropdown(!showSkinToneDropdown)}
                                className={`w-8 h-8 flex items-center justify-center text-lg hover:bg-base-200 border border-base-300 rounded-xl transition-all cursor-pointer ${showSkinToneDropdown ? 'bg-base-200 scale-95' : ''
                                    }`}
                                title="Choose skin tone"
                            >
                                {activeSkinEmoji}
                            </button>

                            {/* Skin Tone Popover */}
                            {showSkinToneDropdown && (
                                <div className="absolute right-0 bottom-full mb-2 bg-base-100 border border-base-300 shadow-2xl rounded-2xl p-1.5 flex gap-1 z-[60] animate-in fade-in slide-in-from-bottom-2">
                                    {SKIN_TONES.map((tone, idx) => (
                                        <button
                                            key={tone.name}
                                            type="button"
                                            onClick={() => {
                                                setSelectedSkinTone(idx);
                                                setShowSkinToneDropdown(false);
                                            }}
                                            className={`w-8 h-8 flex items-center justify-center text-lg hover:bg-base-200 rounded-xl transition-all cursor-pointer ${selectedSkinTone === idx ? 'bg-primary/20 border border-primary/40' : ''
                                                }`}
                                            title={tone.name}
                                        >
                                            {tone.emoji}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {searchQuery.trim() === '' && (
                        <div className="flex items-center justify-between px-1 bg-base-200 border-b border-base-300 h-10 shrink-0 select-none overflow-x-auto no-scrollbar">
                            {categories.map((cat) => {
                                const Icon = CATEGORY_META[cat.id]?.icon || Smile;
                                const isActive = activeTab === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => handleTabClick(cat.id)}
                                        className={`flex-1 py-2 flex justify-center items-center transition-colors cursor-pointer relative h-full ${isActive ? 'text-primary' : 'text-base-content/50 hover:text-base-content/80'
                                            }`}
                                        title={cat.label}
                                    >
                                        <Icon className="w-5 h-5 shrink-0" />
                                        {isActive && (
                                            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary rounded-t-full" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default memo(EmojiPickerComponent);
