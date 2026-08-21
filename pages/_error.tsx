export default function CustomError() {
  return <h1>Error occurred</h1>
}
CustomError.getInitialProps = ({ res, err }: any) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}
