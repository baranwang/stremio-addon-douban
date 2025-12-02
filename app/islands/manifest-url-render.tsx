interface ManifestUrlRenderProps {
  url: string;
}

export const ManifestUrlRender = (props: ManifestUrlRenderProps) => {
  return (
    <code
      className="rounded-md bg-neutral-100 px-2 py-1"
      onClick={() => {
        navigator?.clipboard?.writeText(props.url).then(() => {
          alert("Copied to clipboard");
        });
      }}
      onKeyPress={() => {}}
    >
      {props.url}
    </code>
  );
};
