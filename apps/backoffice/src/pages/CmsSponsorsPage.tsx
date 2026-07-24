import { ImageListSection } from '../features/cms/ImageListSection';

export default function CmsSponsorsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">CMS: Sponsors</h1>
      <div className="mt-4">
        <ImageListSection
          kind="SPONSOR_LOGO"
          description="Shown in the player app's footer, in the order below."
        />
      </div>
    </div>
  );
}
