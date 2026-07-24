import { ImageListSection } from '../features/cms/ImageListSection';

export default function CmsPaymentsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">CMS: Payments</h1>
      <div className="mt-4">
        <ImageListSection
          kind="PAYMENT_METHOD"
          description="Shown in the player app's footer, in the order below. The footer section stays hidden until at least one is uploaded."
        />
      </div>
    </div>
  );
}
