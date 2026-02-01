
import DevicesChart from '../components/charts/DevicesChart'

export default function Dashboard() {
  const data = [
    { status: 'Autorizado', count: 10 },
    { status: 'Pendiente', count: 4 },
    { status: 'Revocado', count: 2 }
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard Cerebro</h1>
      <DevicesChart data={data} />
    </div>
  )
}
