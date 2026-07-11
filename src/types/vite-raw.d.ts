// Vite ?raw import support for TypeScript
declare module "*?raw" {
  const content: string;
  export default content;
}
