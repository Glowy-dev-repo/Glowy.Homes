/** @jsxRuntime automatic */
// The pragma keeps scripts run by tsx (the phase gate) on the automatic JSX runtime, like Next.
import { Body, Button, Column, Container, Head, Heading, Hr, Html, Img, Link, Preview, Row, Section, Text } from "@react-email/components";
import { render } from "@react-email/render";
import { brand } from "@/config/brand";
import { alertSubject } from "@/lib/alerts/window";
import { formatBaths, formatBeds, formatPrice } from "@/lib/format";

export type AlertCard = {
  href: string;
  photoUrl: string | null;
  price: number;
  listingType: "sale" | "rent";
  beds: number | null;
  baths: number | null;
  address: string;
};

export type SavedSearchAlertProps = {
  searchName: string;
  total: number;
  cards: AlertCard[];
  searchHref: string;
  unsubscribeHref: string;
  frequencyLabel: string;
};

const muted = { color: "#71717a", fontSize: "13px", lineHeight: "1.5" };

/** docs/03 section 6: up to 10 cards, a link to the full search, one click unsubscribe. */
export function SavedSearchAlert({ searchName, total, cards, searchHref, unsubscribeHref, frequencyLabel }: SavedSearchAlertProps) {
  const subject = alertSubject(total, searchName);
  return (
    <Html lang="en">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ margin: 0, background: "#fafafa", fontFamily: "Inter, Arial, sans-serif", color: "#18181b" }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "32px 16px" }}>
          <Section style={{ background: "#ffffff", border: "1px solid #e4e4e7", borderRadius: "14px", padding: "28px" }}>
            <Text style={{ margin: "0 0 16px", fontWeight: 600 }}>{brand.name}</Text>
            <Heading as="h1" style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 600 }}>{subject}</Heading>
            <Text style={{ ...muted, margin: "0 0 20px" }}>New matches for your saved search since the last update.</Text>
            {cards.map((c) => (
              <Section key={c.href} style={{ marginBottom: "16px" }}>
                <Link href={c.href} style={{ color: "#18181b", textDecoration: "none" }}>
                  <Row>
                    <Column style={{ width: "150px", verticalAlign: "top" }}>
                      {c.photoUrl ? (
                        <Img src={c.photoUrl} width="140" height="93" alt={c.address} style={{ borderRadius: "8px", objectFit: "cover" }} />
                      ) : null}
                    </Column>
                    <Column style={{ verticalAlign: "top" }}>
                      <Text style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>{formatPrice(c.price, { listingType: c.listingType })}</Text>
                      <Text style={{ margin: "2px 0", fontSize: "14px", color: "#3f3f46" }}>
                        {[formatBeds(c.beds), formatBaths(c.baths)].filter(Boolean).join(", ")}
                      </Text>
                      <Text style={{ margin: 0, fontSize: "14px", color: "#3f3f46" }}>{c.address}</Text>
                    </Column>
                  </Row>
                </Link>
              </Section>
            ))}
            <Button href={searchHref} style={{ background: brand.color, color: "#ffffff", fontWeight: 600, padding: "12px 20px", borderRadius: "10px", marginTop: "8px" }}>
              {total > cards.length ? `See all ${total} new homes` : "Open this search"}
            </Button>
            <Hr style={{ borderColor: "#e4e4e7", margin: "24px 0 12px" }} />
            <Text style={muted}>
              You get {frequencyLabel} updates for this search. <Link href={unsubscribeHref} style={{ color: "#71717a" }}>Stop alerts for this search</Link>.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function savedSearchAlertEmail(props: SavedSearchAlertProps) {
  const el = <SavedSearchAlert {...props} />;
  const [html, text] = await Promise.all([render(el), render(el, { plainText: true })]);
  return { subject: alertSubject(props.total, props.searchName), html, text, link: props.searchHref };
}
