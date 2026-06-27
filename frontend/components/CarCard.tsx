import Link from "next/link";
import PlaceholderPhoto from "@/components/PlaceholderPhoto";
import { fmt, fmtMiles, carSlug, type Car } from "@/lib/cars";

export default function CarCard({ car }: { car: Car }) {
  return (
    <Link className="panel sheen car-card reveal" href={`/prestige/stock/${carSlug(car)}`}>
      <div className="car-photo">
        <PlaceholderPhoto label={car.name} />
        <span className="car-price">{fmt(car.price)}</span>
      </div>
      <div className="car-body">
        <h3 className="car-name">{car.name}</h3>
        <div className="car-chips">
          <span className="chip">{car.year}</span>
          <span className="chip">{fmtMiles(car.mileage)}</span>
          <span className="chip">{car.fuel}</span>
          <span className="chip">{car.gearbox}</span>
        </div>
        <div className="car-foot">
          <span className="car-mo">from <strong>{fmt(car.monthly)}</strong>/mo<i>*</i></span>
          <span className="btn btn-cream car-view">View</span>
        </div>
      </div>
    </Link>
  );
}
