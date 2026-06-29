import Link from 'next/link';

export default function PricingSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold mb-2">Proプランへようこそ！</h1>
        <p className="text-gray-500 text-sm mb-8">
          AIコーチを含む全機能がご利用いただけます。
        </p>
        <Link
          href="/coach"
          className="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition"
        >
          AIコーチを使ってみる
        </Link>
      </div>
    </div>
  );
}
