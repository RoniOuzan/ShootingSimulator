import './ProgressOverlay.css';

interface ProgressOverlayProps {
  progress: number; // 0 to 100
  message?: string;
  eta: number | null; 
}

export default function ProgressOverlay({ 
  progress, 
  message = 'Calculating...', 
  eta: estimatedTimeRemainingMs
}: ProgressOverlayProps) {
  
  // Format milliseconds into "Xm Ys" or "Xs"
  const formatETA = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s left`;
    }
    return `${seconds}s left`;
  };

  return (
    <div className="progress-overlay">
      <div className="progress-content">
        <div className="progress-spinner"></div>
        <p className="progress-message">{message}</p>
        
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
        </div>
        
        <div className="progress-stats">
          <span className="progress-percentage">{Math.round(progress)}%</span>
          {estimatedTimeRemainingMs !== null && progress > 0 && (
             <span className="progress-eta">
               {formatETA(estimatedTimeRemainingMs)}
             </span>
          )}
        </div>
      </div>
    </div>
  );
}