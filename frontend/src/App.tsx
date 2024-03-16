import "./App.css";
import {
  FetchAndRenderCallStatus,
  FetchAndRenderTranscription,
  MakeCall,
} from "./components";

function App() {
  return (
    <main className="container mx-auto p-4 text-center grid lg:grid-cols-3 gap-4">
      <MakeCall />
      <FetchAndRenderTranscription />
      <FetchAndRenderCallStatus />
    </main>
  );
}

export default App;
