import { useState, useRef, useEffect } from 'react';
import { Clapperboard, Search, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const GifPicker = ({ onGifSelect }) => {
    const [showPicker, setShowPicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [gifs, setGifs] = useState([]);
    const [loading, setLoading] = useState(false);
    const pickerRef = useRef(null);
    const searchTimeoutRef = useRef(null);

    // Giphy API configuration
    const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || '5Q8sUvG9LotkV282UKgu2IrO4NAQtOpC'; // Demo key
    const GIPHY_API_URL = 'https://api.giphy.com/v1/gifs';

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setShowPicker(false);
            }
        };

        if (showPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showPicker]);

    // Load trending GIFs and reset search on open
    useEffect(() => {
        if (showPicker) {
            setSearchQuery('');
            fetchTrendingGifs();
        }
    }, [showPicker]);

    const fetchTrendingGifs = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                `${GIPHY_API_URL}/trending?api_key=${GIPHY_API_KEY}&limit=50&rating=g`
            );
            const data = await response.json();
            setGifs(data.data || []);
        } catch (error) {
            console.error('Error fetching trending GIFs:', error);
            toast.error('Failed to load GIFs');
        } finally {
            setLoading(false);
        }
    };

    const searchGifs = async (query) => {
        if (!query.trim()) {
            fetchTrendingGifs();
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(
                `${GIPHY_API_URL}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=50&rating=g`
            );
            const data = await response.json();
            setGifs(data.data || []);
        } catch (error) {
            console.error('Error searching GIFs:', error);
            toast.error('Failed to search GIFs');
        } finally {
            setLoading(false);
        }
    };

    const handleSearchChange = (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        // Debounce search
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            searchGifs(query);
        }, 500);
    };

    const handleGifClick = (gif) => {
        const gifUrl = gif.images?.original?.url || gif.url;
        onGifSelect(gifUrl);
        setShowPicker(false);
        setSearchQuery('');
    };

    return (
        <div className="relative gif-picker-wrapper" ref={pickerRef}>
            <button
                type="button"
                onClick={() => setShowPicker(!showPicker)}
                className="btn btn-circle btn-ghost hover-lift"
                title="Add GIF"
            >
                <Clapperboard className="w-5 h-5" />
            </button>

            {showPicker && (
                <div className="absolute bottom-full right-0 mb-2 z-50 w-[320px] sm:w-[400px] max-h-[350px] sm:max-h-[500px] bg-base-100 rounded-2xl shadow-2xl border border-base-300 overflow-hidden gif-picker-container">
                    {/* Header */}
                    <div className="p-3 sm:p-4 border-b border-base-300 bg-base-200">
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                            <h3 className="font-semibold text-sm sm:text-base">Choose a GIF</h3>
                            <button
                                onClick={() => setShowPicker(false)}
                                className="btn btn-ghost btn-xs sm:btn-sm btn-circle"
                            >
                                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search GIFs..."
                                value={searchQuery}
                                onChange={handleSearchChange}
                                className="input input-bordered input-xs sm:input-sm w-full pl-8 pr-4 focus:outline-none text-xs sm:text-sm"
                            />
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/50 pointer-events-none" />
                        </div>
                    </div>

                    {/* GIF Grid */}
                    <div className="overflow-y-auto max-h-[220px] sm:max-h-[380px] gif-grid-container">
                        <div className="p-1 sm:p-2">
                            {loading ? (
                                <div className="flex items-center justify-center py-8 sm:py-12">
                                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-primary" />
                                </div>
                            ) : gifs.length > 0 ? (
                                <div className="grid grid-cols-3 gap-1 sm:grid-cols-2 sm:gap-2">
                                    {gifs.map((gif) => (
                                        <div
                                            key={gif.id}
                                            onClick={() => handleGifClick(gif)}
                                            className="relative cursor-pointer rounded-lg overflow-hidden hover:opacity-80 transition-opacity aspect-square gif-item bg-base-200"
                                        >
                                            <img
                                                src={gif.images?.fixed_height_small?.url || gif.images?.original?.url}
                                                alt={gif.title || 'GIF'}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                                style={{ minHeight: '100%' }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 sm:py-12 text-base-content/50">
                                    <p className="text-xs sm:text-base">No GIFs found</p>
                                    <p className="text-[10px] sm:text-sm mt-0.5 sm:mt-1">Try a different search</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-1.5 sm:p-2 border-t border-base-300 bg-base-200 text-center">
                        <p className="text-[10px] sm:text-xs text-base-content/50">Powered by GIPHY</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GifPicker;
