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

    // Tenor API configuration
    const TENOR_API_KEY = import.meta.env.VITE_TENOR_API_KEY || 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'; // Demo key
    const TENOR_API_URL = 'https://tenor.googleapis.com/v2';

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

    // Load trending GIFs on open
    useEffect(() => {
        if (showPicker && gifs.length === 0) {
            fetchTrendingGifs();
        }
    }, [showPicker]);

    const fetchTrendingGifs = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                `${TENOR_API_URL}/featured?key=${TENOR_API_KEY}&limit=20&media_filter=gif`
            );
            const data = await response.json();
            setGifs(data.results || []);
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
                `${TENOR_API_URL}/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=20&media_filter=gif`
            );
            const data = await response.json();
            setGifs(data.results || []);
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
        const gifUrl = gif.media_formats?.gif?.url || gif.url;
        onGifSelect(gifUrl);
        setShowPicker(false);
        setSearchQuery('');
    };

    return (
        <div className="relative" ref={pickerRef}>
            <button
                type="button"
                onClick={() => setShowPicker(!showPicker)}
                className="btn btn-circle btn-ghost hover-lift"
                title="Add GIF"
            >
                <Clapperboard className="w-5 h-5" />
            </button>

            {showPicker && (
                <div className="absolute bottom-full right-0 mb-2 z-50 w-[400px] max-h-[500px] bg-base-100 rounded-2xl shadow-2xl border border-base-300 overflow-hidden gif-picker-container">
                    {/* Header */}
                    <div className="p-4 border-b border-base-300 bg-base-200">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-lg">Choose a GIF</h3>
                            <button
                                onClick={() => setShowPicker(false)}
                                className="btn btn-ghost btn-sm btn-circle"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/50" />
                            <input
                                type="text"
                                placeholder="Search GIFs..."
                                value={searchQuery}
                                onChange={handleSearchChange}
                                className="input input-bordered w-full pl-10 pr-4"
                            />
                        </div>
                    </div>

                    {/* GIF Grid */}
                    <div className="p-3 overflow-y-auto max-h-[380px] gif-grid-container">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : gifs.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                {gifs.map((gif) => (
                                    <div
                                        key={gif.id}
                                        onClick={() => handleGifClick(gif)}
                                        className="relative cursor-pointer rounded-lg overflow-hidden hover:opacity-80 transition-opacity aspect-square gif-item"
                                    >
                                        <img
                                            src={gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url}
                                            alt={gif.content_description || 'GIF'}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-base-content/50">
                                <p>No GIFs found</p>
                                <p className="text-sm mt-1">Try a different search</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-2 border-t border-base-300 bg-base-200 text-center">
                        <p className="text-xs text-base-content/50">Powered by Tenor</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GifPicker;
