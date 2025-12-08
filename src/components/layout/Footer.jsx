import version from "../../version.json";

export default function Footer() {
  return (
    <footer className="text-center text-gray-500 text-sm mt-8">
      &copy; {new Date().getFullYear()} Amigo Secreto. Todos os direitos
      reservados.
      <span className="ml-2 text-gray-400">v{version.build}</span>
    </footer>
  );
}
