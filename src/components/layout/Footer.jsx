import version from "../../version.json";

export default function Footer() {
  return (
    <footer className="flex flex-col items-center justify-center gap-1 text-center text-gray-500 text-sm">
      &copy; {new Date().getFullYear()} Amigo Secreto. Todos os direitos
      reservados.
      <span className="text-xs text-gray-300">v{version.build}</span>
    </footer>
  );
}
