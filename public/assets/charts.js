/** Draw directly from editable data; redraw on resize for crisp HiDPI output. */
export function drawChart(canvas, element) {
  const { width, height, content, type } = element;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * ratio; canvas.height = height * ratio;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  if (height < 140 || width < 160) return;
  const left = 45, right = 22, top = 90, bottom = height - 35;
  const plotWidth = width - left - right, plotHeight = bottom - top;
  if (plotHeight <= 0) return;
  const max = Math.max(10, Math.ceil(Math.max(...content.values) / 10) * 10);
  ctx.font = '10px sans-serif'; ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const y = top + plotHeight * i / 4;
    ctx.strokeStyle = '#efedf4'; ctx.lineWidth = 1;ctx.beginPath();ctx.moveTo(left, y);ctx.lineTo(width - right, y);ctx.stroke();
    ctx.fillStyle = '#aaa4b5';ctx.textAlign = 'right';ctx.fillText(String(Math.round(max * (1 - i / 4))), left - 10, y);
  }
  const step = plotWidth / content.values.length;
  const points = content.values.map((value, index) => ({ x: left + step * (index + .5), y: bottom - value / max * plotHeight }));
  if (type === 'bar') {
    points.forEach((point, index) => {
      ctx.fillStyle = index === points.length - 1 ? content.accent : content.accent + '66';
      const w = Math.min(38, step * .62);
      ctx.beginPath(); ctx.roundRect(point.x - w / 2, point.y, w, Math.max(0, bottom - point.y), [4, 4, 0, 0]); ctx.fill();
    });
  } else {
    const gradient = ctx.createLinearGradient(0, top, 0, bottom);gradient.addColorStop(0, content.accent + '35');gradient.addColorStop(1, content.accent + '02');
    ctx.beginPath();ctx.moveTo(points[0].x, bottom);points.forEach(p => ctx.lineTo(p.x, p.y));ctx.lineTo(points.at(-1).x, bottom);ctx.closePath();ctx.fillStyle = gradient;ctx.fill();
    ctx.beginPath();points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));ctx.strokeStyle = content.accent;ctx.lineWidth = 2.5;ctx.lineJoin = 'round';ctx.stroke();
    points.forEach(p => {ctx.beginPath();ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);ctx.fillStyle = '#ffffff';ctx.fill();ctx.strokeStyle = content.accent;ctx.lineWidth = 2;ctx.stroke();});
  }
  ctx.fillStyle = '#aaa4b5';ctx.textAlign = 'center';
  const stride = Math.max(1, Math.ceil(content.labels.length / Math.max(2, plotWidth / 45)));
  content.labels.forEach((label, i) => {if (i % stride === 0) ctx.fillText(label.length > 7 ? label.slice(0, 6) + '…' : label, points[i].x, height - 15);});
}
