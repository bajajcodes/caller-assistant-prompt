import "./App.css";
import {
  FetchAndRenderCallStatus,
  FetchAndRenderTranscription,
  MakeCall,
} from "./components";

function App() {
  return (
    <main className="container mx-auto md:max-w-screen-sm lg:max-w-screen-lg p-4 text-center grid lg:grid-cols-3 gap-4">
      <MakeCall />
      <FetchAndRenderTranscription />
      <FetchAndRenderCallStatus />
    </main>
  );
}

export default App;
