// The real SKH Inc wordmark. The source PNG is a padded square, so it's
// cropped to the artwork band via object-fit in globals.css (.brand-img).
export default function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={"brand-img" + (className ? " " + className : "")} src="/logos/skh.png" alt="SKH Inc" />
  );
}
