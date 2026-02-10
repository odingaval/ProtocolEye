/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        "./src/**/*.{html,ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'primary': 'var(--color-primary)',
                'secondary': 'var(--color-secondary)',
                'base': 'var(--color-base)',
                'card': 'var(--color-card)',
                'border': 'var(--color-border)',
                'main': 'var(--color-text-main)',
                'muted': 'var(--color-text-muted)',
            }
        },
    },
    plugins: [],
}
