import "./App.css";
import {
  FetchAndRenderApplicationStatus,
  FetchAndRenderCallStatus,
  FetchAndRenderTranscription,
  MakeCall,
} from "./components";

function App() {
  return (
    <main className="container mx-auto p-4 text-center grid lg:grid-cols-2 gap-4">
      <div>
        <MakeCall />
        <FetchAndRenderCallStatus />
      </div>
      <div>
        <FetchAndRenderApplicationStatus />
        <FetchAndRenderTranscription />
      </div>
    </main>
  );
}

export default App;
