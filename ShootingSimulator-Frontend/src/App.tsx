import './App.css';
import TrajectoryVisualizer from './TrajectoryVisualizer'; // Your component

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>REBUILT Target Simulator</h1>
        <p>Live trajectory calculation and hardware constraint mapping</p>
      </header>
      
      <main>
        <TrajectoryVisualizer />
      </main>
    </div>
  );
}

export default App;