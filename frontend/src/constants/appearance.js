// Wallpaper presets for chat backgrounds
export const CHAT_WALLPAPERS = {
    solid: [
        { id: 'default', name: 'Default', value: 'default', preview: '#f5f5f5' },
        { id: 'dark', name: 'Dark Gray', value: '#1f2937', preview: '#1f2937' },
        { id: 'navy', name: 'Navy Blue', value: '#1e3a8a', preview: '#1e3a8a' },
        { id: 'forest', name: 'Forest Green', value: '#065f46', preview: '#065f46' },
        { id: 'plum', name: 'Deep Plum', value: '#581c87', preview: '#581c87' },
        { id: 'rose', name: 'Rose', value: '#9f1239', preview: '#9f1239' },
    ],
    gradients: [
        { id: 'sunset', name: 'Sunset', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
        { id: 'ocean', name: 'Ocean', value: 'linear-gradient(135deg, #667eea 0%, #667eea 100%)', preview: 'linear-gradient(135deg, #667eea 0%, #667eea 100%)' },
        { id: 'fire', name: 'Fire', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', preview: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
        { id: 'mint', name: 'Mint', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', preview: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
    ],
    patterns: [
        { id: 'dots', name: 'Dots', value: 'dots', preview: 'radial-gradient(circle, #000 1px, transparent 1px)', patternSize: '20px 20px' },
        { id: 'stripes', name: 'Stripes', value: 'stripes', preview: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.05) 10px, rgba(0,0,0,0.05) 20px)' },
    ]
};

export const FONT_SIZES = [
    { id: 'small', name: 'Small', value: 'small', description: 'Compact text for more content' },
    { id: 'standard', name: 'Standard', value: 'standard', description: 'Default comfortable reading' },
    { id: 'large', name: 'Large', value: 'large', description: 'Bigger text for better readability' },
];

export const BUBBLE_STYLES = [
    { id: 'sharp', name: 'Sharp', value: 'sharp', borderRadius: '4px', description: 'Minimal roundness' },
    { id: 'classic', name: 'Classic', value: 'classic', borderRadius: '8px', description: 'Slightly rounded' },
    { id: 'rounded', name: 'Rounded', value: 'rounded', borderRadius: '16px', description: 'Medium roundness' },
    { id: 'smooth', name: 'Smooth', value: 'smooth', borderRadius: '20px', description: 'Very smooth' },
    { id: 'ultra', name: 'Ultra', value: 'ultra', borderRadius: '24px', description: 'Maximum roundness' },
    { id: 'pill', name: 'Pill', value: 'pill', borderRadius: '32px', description: 'Pill-shaped bubbles' },
];
