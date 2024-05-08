import "./App.css";
import { CallLog } from "./components/call-log";
import { MakeCallForm } from "./components/make-call";

function App() {
  return (
    <main className="min-h-screen w-full px-4 py-6 mx-auto  grid gap-4 lg:gap-10 md:grid-cols-2 ">
      <MakeCallForm />
      <CallLog />
    </main>
  );
}

export default App;
