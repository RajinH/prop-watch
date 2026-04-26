export default function Footer() {
  return (
    <footer className="bg-slate-100 px-6 py-10 mt-auto">
      <p className="text-xs text-slate-400 text-center">
        © {new Date().getFullYear()} PropWatch. Built for property investors.
        <br />
        Made with love in Sydney, Australia 💚
      </p>
    </footer>
  );
}
