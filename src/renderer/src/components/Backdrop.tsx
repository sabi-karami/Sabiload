export function Backdrop(): React.JSX.Element {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="stars" />
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="grid" />
    </div>
  )
}
