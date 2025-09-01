# AZR - Aozora Reader

A modern, feature-rich reader application for Aozora Bunko formatted Japanese text files. Built with React, TypeScript, and Tauri for a native desktop experience.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

## ✨ Features

### 📖 Reading Experience
- **Vertical & Horizontal Writing Modes**: Switch between traditional Japanese vertical writing (縦書き) and horizontal writing (横書き)
- **Pagination System**: Automatic text pagination with smooth page transitions
- **Smart Text Centering**: Automatic centering for pages with less content, headings, or single lines
- **Customizable Display**: Adjust font size, line height, and padding to your preference
- **Dark Mode Support**: Easy on the eyes with built-in dark mode

### 📚 Library Management
- **Book Library**: Save and organize your Aozora Bunko texts
- **Reading Progress**: Automatically saves your reading position
- **Search & Filter**: Find books by title or author
- **Multiple Sort Options**: Sort by last read, added date, title, author, or reading progress
- **Grid & List Views**: Choose your preferred library display mode

### 🎨 Aozora Bunko Format Support
- **Full Format Support**: Handles all Aozora Bunko formatting tags
- **Ruby Text**: Proper display of furigana annotations
- **Emphasis Marks**: Support for dots and various emphasis styles
- **Headers & Headings**: Automatic page breaks before headings for better readability
- **Special Characters**: Proper rendering of gaiji and special notation

### 💾 Data Management
- **Automatic Saving**: Your reading progress and settings are automatically saved
- **Persistent Storage**: Books and progress are stored locally using IndexedDB
- **Import/Export**: Easy file management with drag & drop support

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Rust (for Tauri development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/azr.git
cd azr
```

2. Install dependencies:
```bash
pnpm install
```

3. Run the development server:
```bash
# Web development
pnpm dev

# Tauri desktop app development
pnpm tauri dev
```

### Building for Production

```bash
# Build web version
pnpm build

# Build Tauri desktop app
pnpm tauri build
```

## 📝 Usage

### Adding Books

1. **Drag & Drop**: Simply drag a `.txt` file onto the drop zone
2. **Click to Browse**: Click the upload area to browse and select files
3. **Save to Library**: After opening a file, click "ライブラリに保存" to save it

### Reading Controls

- **Page Navigation**:
  - Horizontal mode: `↑`/`↓` or `Page Up`/`Page Down`
  - Vertical mode: `←`/`→` or `Page Up`/`Page Down`
- **Text Size**: Adjust using the settings panel
- **Writing Mode**: Toggle between vertical/horizontal in settings

### Library Management

- **Search**: Type in the search box to filter by title or author
- **Sort**: Click the sort dropdown to change ordering
- **View Mode**: Switch between grid and list views
- **Delete Books**: Click the trash icon (with confirmation dialog)

## 🛠 Development

### Project Structure

```
azr/
├── src/
│   ├── components/     # React components
│   │   ├── Reader/     # Main reader component
│   │   ├── Library/    # Library management
│   │   ├── Settings/   # Settings panel
│   │   └── FileUpload/ # File upload component
│   ├── core/           # Core parsing and storage logic
│   ├── utils/          # Utility functions
│   └── types/          # TypeScript type definitions
├── src-tauri/          # Tauri backend
└── public/             # Static assets
```

### Key Technologies

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, daisyUI
- **Desktop**: Tauri
- **Storage**: IndexedDB (Dexie)
- **Testing**: Vitest, React Testing Library

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## 🎯 Keyboard Shortcuts

| Action | Horizontal Mode | Vertical Mode |
|--------|----------------|---------------|
| Next Page | `↓` or `Page Down` | `←` |
| Previous Page | `↑` or `Page Up` | `→` |
| Open Settings | `S` | `S` |
| Open Library | `L` | `L` |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Aozora Bunko](https://www.aozora.gr.jp/) for preserving Japanese literature
- [Tauri](https://tauri.app/) for the excellent desktop framework
- [React](https://reactjs.org/) and the amazing JavaScript ecosystem

## 📧 Contact

For questions or suggestions, please open an issue on GitHub.

---

Made with ❤️ for Japanese literature enthusiasts