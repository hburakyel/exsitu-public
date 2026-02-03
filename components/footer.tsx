export default function Footer() {
  return (
    <footer className="bg-gray-100 dark:bg-gray-900 py-12 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">Ex-Situ</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Mapping Artefact Migration across museums and institutions worldwide.
            </p>
            <div className="mt-4 flex space-x-4">
              <a
                href="https://www.are.na/ex-situ"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:underline"
              >
                Are.na
              </a>
              <a
                href="https://github.com/your-username/ex-situ"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:underline"
              >
                GitHub
              </a>
              <a href="mailto:contact@exsitu.site" className="text-sm hover:underline">
                Contact
              </a>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Legal Information</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              All images and related content displayed on this website are hosted on third-party museum websites and are
              not stored on our servers. This project uses hyperlinks to reference these images information.
            </p>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-center text-xs text-gray-600 dark:text-gray-400">
            © {new Date().getFullYear()} Ex-Situ. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
