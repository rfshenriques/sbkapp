import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-sm py-12 text-center">
      <div className="mb-3 flex items-center justify-center gap-2">
        <span className="brand-flag" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
        <h1 className="font-display text-xl">Page not found</h1>
      </div>
      <p className="mt-2 text-sm text-text-secondary">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary mt-6 inline-block">
        Back to home
      </Link>
    </div>
  );
}
