import "./harness/loadEnv";
import { MockCashfreeGateway } from "./harness/mockCashfreeServer";
import { TestClient } from "./harness/testClient";
import { createTestCustomerFixture, cleanupCustomerFixture } from "./harness/dbHelpers";

async function main() {
  const mockGateway = new MockCashfreeGateway();
  const testClient = new TestClient();

  const { baseUrl: mockBaseUrl } = await mockGateway.start();
  process.env.CASHFREE_BASE_URL = mockBaseUrl;
  process.env.CASHFREE_APP_ID = mockGateway.clientId;
  process.env.CASHFREE_SECRET_KEY = mockGateway.secretKey;
  process.env.CASHFREE_ENV = "sandbox";
  process.env.CASHFREE_API_VERSION = "2023-08-01";

  await testClient.start();

  const fixture = await createTestCustomerFixture({ balanceDue: 1500.0 });
  console.log("Created fixture:", {
    customerId: fixture.customerId,
    userId: fixture.userId,
    token: fixture.token.slice(0, 10) + "...",
    authHeaders: fixture.authHeaders,
  });

  const resOrder = await testClient.post(
    "/api/payments/cashfree/create-order",
    { invoiceId: fixture.invoiceId },
    fixture.authHeaders
  );
  console.log("create-order status:", resOrder.status, resOrder.data);

  const resMe = await testClient.get("/api/customers/me", fixture.authHeaders);
  console.log("customers/me status:", resMe.status, resMe.data);

  await cleanupCustomerFixture(fixture);
  await testClient.stop();
  await mockGateway.stop();
  process.exit(0);
}

main().catch(console.error);
