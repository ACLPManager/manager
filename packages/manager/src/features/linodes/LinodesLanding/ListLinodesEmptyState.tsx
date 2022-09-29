import * as React from 'react';
import { useHistory } from 'react-router-dom';
import LinodeSvg from 'src/assets/icons/entityIcons/linode.svg';
import Typography from 'src/components/core/Typography';
import Placeholder from 'src/components/Placeholder';
import LinksSection from './LinksSection';
import LinksSubSection from './LinksSubSection';
import DocsIcon from 'src/assets/icons/docs.svg';
import MarketplaceIcon from 'src/assets/icons/marketplace.svg';
import YoutubeIcon from 'src/assets/icons/youtube.svg';
import PointerIcon from 'src/assets/icons/pointer.svg';
import ExternalLinkIcon from 'src/assets/icons/external-link.svg';
import Link from 'src/components/Link';
import List from 'src/components/core/List';
import ListItem from 'src/components/core/ListItem';
import AppsSection from './AppsSection';

export const ListLinodesEmptyState: React.FC<{}> = (_) => {
  const { push } = useHistory();

  return (
    <Placeholder
      title={'Linodes'}
      subtitle="Cloud-based virtual machines"
      icon={LinodeSvg}
      isEntity
      buttonProps={[
        {
          onClick: () => {
            push('/linodes/create');
          },
          children: 'Create Linode',
        },
      ]}
      linksSection={
        <LinksSection>
          <LinksSubSection
            title="Getting Started Guides"
            icon={<DocsIcon />}
            moreLink={
              <Link to="https://www.linode.com/docs/">
                Check out all our Docs <PointerIcon />
              </Link>
            }
          >
            <List>
              <ListItem>
                <Link to="https://www.linode.com/docs/guides/creating-a-compute-instance/">
                  Create a Compute Instance
                </Link>
              </ListItem>
              <ListItem>
                <Link to="https://www.linode.com/docs/guides/getting-started/">
                  Getting Started with Linode Compute Instances
                </Link>
              </ListItem>
              <ListItem>
                <Link to="https://www.linode.com/docs/guides/understanding-billing-and-payments/">
                  Understanding Billing and Payment
                </Link>
              </ListItem>
              <ListItem>
                <Link to="https://www.linode.com/docs/guides/set-up-web-server-host-website/">
                  Hosting a Website or Application on Linode
                </Link>
              </ListItem>
            </List>
          </LinksSubSection>
          <LinksSubSection
            title="Deploy an App"
            icon={<MarketplaceIcon />}
            moreLink={
              <Link to="/linodes/create?type=One-Click">
                See all Marketplace apps <PointerIcon />
              </Link>
            }
          >
            <AppsSection />
          </LinksSubSection>
          <LinksSubSection
            title="Getting Started Playlist"
            icon={<YoutubeIcon />}
            moreLink={
              <Link to="https://www.youtube.com/playlist?list=PLTnRtjQN5ieb4XyvC9OUhp7nxzBENgCxJ">
                View the complete playlist{' '}
                <ExternalLinkIcon style={{ marginLeft: 8 }} />
              </Link>
            }
          >
            <List>
              <ListItem>
                <Link to="https://www.linode.com/docs/guides/creating-a-compute-instance/">
                  Linode Getting Started Guide
                  <ExternalLinkIcon style={{ marginLeft: 8 }} />
                </Link>
              </ListItem>
              <ListItem>
                <Link to="https://www.linode.com/docs/guides/getting-started/">
                  Common Linux Commands
                  <ExternalLinkIcon style={{ marginLeft: 8 }} />
                </Link>
              </ListItem>
              <ListItem>
                <Link to="https://www.linode.com/docs/guides/understanding-billing-and-payments/">
                  Copying Files to a Compute Instance
                  <ExternalLinkIcon style={{ marginLeft: 8 }} />
                </Link>
              </ListItem>
              <ListItem>
                <Link to="https://www.linode.com/docs/guides/set-up-web-server-host-website/">
                  How to use SSH
                  <ExternalLinkIcon style={{ marginLeft: 8 }} />
                </Link>
              </ListItem>
            </List>
          </LinksSubSection>
        </LinksSection>
      }
    >
      <Typography
        style={{ fontSize: '1.125rem', lineHeight: '1.75rem', maxWidth: 541 }}
      >
        Host your websites, applications, or any other Cloud-based workloads on
        a scalable and reliable platform.
      </Typography>
    </Placeholder>
  );
};

export default React.memo(ListLinodesEmptyState);
