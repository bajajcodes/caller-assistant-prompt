import "./App.css";
import { CallProvider } from "./components/call-context";
import { CallLog } from "./components/call-log";
import { MakeCallForm } from "./components/make-call";

function App() {
  return (
    <CallProvider>
      <main className="min-h-screen w-full grid max-w-4xl grid-cols-1 gap-6 px-4 py-6 mx-auto  lg:gap-10 md:grid-cols-2 ">
        <MakeCallForm />
        <CallLog />
      </main>
    </CallProvider>
  );
}

export default App;
