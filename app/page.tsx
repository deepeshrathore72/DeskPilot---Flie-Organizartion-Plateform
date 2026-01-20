import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            DeskPilot
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Smart Downloads Organizer • Duplicate Finder • Rollback • Report Dashboard
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors"
          >
            Open Dashboard
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <FeatureCard
            icon="📁"
            title="Smart Organize"
            description="Automatically organize files into Documents, Images, Videos, Audio, and more."
          />
          <FeatureCard
            icon="🔍"
            title="Duplicate Finder"
            description="Detect duplicate files using SHA-256 hashing and free up disk space."
          />
          <FeatureCard
            icon="⏪"
            title="Rollback"
            description="Made a mistake? Rollback any operation with full transaction history."
          />
          <FeatureCard
            icon="📊"
            title="Reports"
            description="Get detailed insights about your files, categories, and space usage."
          />
        </div>

        {/* CLI Commands */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8 text-gray-200">CLI Commands</h2>
          <div className="bg-gray-900 rounded-lg p-6 font-mono text-sm">
            <div className="space-y-3">
              <CommandLine command="deskpilot scan <path>" description="Scan directory and detect duplicates" />
              <CommandLine command="deskpilot organize <path> [--dry-run]" description="Organize files into categories" />
              <CommandLine command="deskpilot dedupe <path> [--strategy=keep-latest]" description="Remove duplicate files" />
              <CommandLine command="deskpilot rollback <transactionId>" description="Undo a previous operation" />
              <CommandLine command="deskpilot report" description="Generate comprehensive report" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-cyan-800 transition-colors">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}

function CommandLine({ command, description }: { command: string; description: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <code className="text-cyan-400">$ {command}</code>
      <span className="text-gray-500 text-xs sm:ml-auto">{description}</span>
    </div>
  );
}
