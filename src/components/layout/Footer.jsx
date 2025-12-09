import version from "../../version.json";

export default function Footer() {
  return (
    <footer className="flex items-center justify-center gap-2 text-center text-gray-500 text-sm">
      &copy; {new Date().getFullYear()} Amigo Secreto. Todos os direitos
      reservados.
      <span className="text-gray-400">v{version.build}</span>
    </footer>
  );
}
