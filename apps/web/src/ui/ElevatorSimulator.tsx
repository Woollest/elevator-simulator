import { useElevatorSimulation } from '../simulation/useElevatorSimulation';
import type { HallCall } from '../domain/elevator';

function CallButton({ direction, active, onPress }: { direction: HallCall; active: boolean; onPress: () => void }) {
  const up = direction === 'up';
  return <button className={`call-button ${active ? 'lit' : ''}`} onClick={onPress} aria-label={`${up ? '上り' : '下り'}エレベーターを呼ぶ`} aria-pressed={active}>
    <span className="button-rim"><span className="button-face"><span className="button-arrow">{up ? '▲' : '▼'}</span></span></span>
  </button>;
}

export function ElevatorSimulator() {
  const simulation = useElevatorSimulation();
  return <main className="hall" aria-label="12階のエレベーターホール">
    <div className="ceiling" aria-hidden="true"><span className="light light--left"/><span className="light light--right"/><span className="downlight"/></div>
    <div className="wall wall--left" aria-hidden="true"/><div className="wall-joint wall-joint--left" aria-hidden="true"/><div className="wall-joint wall-joint--right" aria-hidden="true"/>
    <div className="security-camera" aria-hidden="true"><span className="camera-arm"/><span className="camera-body"><i/></span></div>
    <div className="hall-speaker" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index}/>)}</div>
    <div className="floor-plaque" aria-label="現在の階は12階"><span>12</span><small>F</small></div>
    <section className="elevator" aria-label="エレベーター">
      <div className="indicator-housing"><div className="indicator" aria-live="polite"><span className="indicator-glass"/><span key={simulation.displayTick} className="floor-number changing">{simulation.floor}</span><span className={`direction ${simulation.moving ? '' : 'idle'}`} aria-label={simulation.direction > 0 ? '上昇中' : '下降中'}>{simulation.direction > 0 ? '▲' : '▼'}</span></div></div>
      <div className="lintel"/><div className={`door-frame ${simulation.doorsOpen ? 'open' : ''}`}><div className="cab"><div className="cab-ceiling"><i/><i/></div><div className="cab-back"><span className="cab-seam"/></div><div className="cab-floor"/></div><div className="door door--left"><span/></div><div className="door door--right"><span/></div><div className="door-shadow"/></div><div className="sill"/>
    </section>
    <aside className="call-panel" aria-label="エレベーター呼び出しパネル">
      <i className="panel-screw panel-screw--tl"/><i className="panel-screw panel-screw--tr"/>
      <CallButton direction="up" active={simulation.calls.up} onPress={() => void simulation.press('up')}/>
      <CallButton direction="down" active={simulation.calls.down} onPress={() => void simulation.press('down')}/>
      <span className="panel-mark">ELEVATOR</span><i className="panel-screw panel-screw--bl"/><i className="panel-screw panel-screw--br"/>
    </aside>
    <div className={`building-notice ${simulation.notice ? 'show' : ''} ${simulation.noticeLevel}`} role="alert"><small>{simulation.noticeLevel === 'alarm' ? 'WARNING' : 'BUILDING INFORMATION'}</small><strong>{simulation.notice}</strong></div>
    <div className="wall wall--right"/><div className="baseboard"/><div className="floor"><div className="reflection"/></div>
  </main>;
}
