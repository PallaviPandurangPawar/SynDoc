// Reusable 3D flip loading animation, shown while a page is fetching data
import './Loader.css';

export default function Loader({ label }) {
  return (
    <div className="flip-loader-wrapper">
      <div className="flip"></div>
      {label && <p className="flip-loader-label">{label}</p>}
    </div>
  );
}