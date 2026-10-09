/**
 * Re-mounted on every navigation inside the signed-in app, which is what lets the
 * page fade in. The animation itself lives in globals.css (`.ksa-page-enter`): a
 * 150ms opacity fade and nothing else. It never animates layout and does nothing
 * for users who prefer reduced motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="ksa-page-enter">{children}</div>;
}
